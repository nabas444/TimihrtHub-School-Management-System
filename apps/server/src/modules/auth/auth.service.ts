import bcrypt from "bcryptjs";
import { Role, AuthProvider } from "@prisma/client";
import { OAuth2Client } from "google-auth-library";
import { db } from "../../config/database";
import { cacheDel } from "../../config/redis";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  generateOpaqueToken,
  getRefreshTokenExpiry,
  getPasswordResetExpiry,
} from "../../utils/jwt";
import { AppError } from "../../middleware/errorHandler";
import { logger } from "../../utils/logger";
import {
  sendWelcomeEmail,
  sendPasswordResetEmail,
} from "../../jobs/emailWorker";
import { recordAuditEvent } from "../../utils/auditLog";
import { Request } from "express";
import * as UsersService from "../users/users.service";

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS ?? "12");
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── Register a new school + first admin ─────────────────────────────────────
export const registerSchool = async (data: {
  schoolName: string;
  schoolEmail: string;
  schoolPhone?: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  password: string;
  country?: string;
}) => {
  const existingAdmin = await db.user.findFirst({
    where: { email: data.adminEmail },
  });
  if (existingAdmin) throw new AppError("Email already in use", 409);

  const slug = data.schoolName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);

  // Check slug uniqueness
  const existingSlug = await db.school.findFirst({
    where: { slug: { startsWith: slug } },
  });
  const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

  const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

  const result = await db.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: {
        name: data.schoolName,
        slug: finalSlug,
        email: data.schoolEmail,
        phone: data.schoolPhone,
        country: data.country ?? "Ethiopia",
        settings: { create: {} },
        subscription: {
          create: {
            plan: "FREE",
            status: "TRIALING",
            trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });

    const admin = await tx.user.create({
      data: {
        schoolId: school.id,
        role: Role.ADMIN,
        email: data.adminEmail,
        password: hashedPassword,
        firstName: data.adminFirstName,
        lastName: data.adminLastName,
        isEmailVerified: false,
        adminProfile: {
          create: { isSuperAdmin: true },
        },
      },
    });

    return { school, admin };
  });

  logger.info(
    `New school registered: ${result.school.name} (${result.school.id})`,
  );

  await sendWelcomeEmail(
    result.admin.email,
    `${result.admin.firstName} ${result.admin.lastName}`,
    result.admin.role,
  );

  return result;
};

// ── Login ────────────────────────────────────────────────────────────────────
export const login = async (
  email: string,
  password: string,
  schoolSlug?: string,
  req?: Request,
) => {
  const whereClause = schoolSlug
    ? { email, school: { slug: schoolSlug } }
    : { email };

  const user = await db.user.findFirst({
    where: whereClause,
    include: {
      school: { select: { id: true, name: true, slug: true, isActive: true } },
    },
  });

  if (!user) {
    if (schoolSlug) {
      const sch = await db.school.findFirst({ where: { slug: schoolSlug } });
      if (sch) {
        await recordAuditEvent({
          schoolId: sch.id,
          actorEmail: email,
          action: "LOGIN_FAILED",
          targetType: "User",
          metadata: { reason: "User not found for email" },
          req,
        });
      }
    }
    throw new AppError("Invalid email or password", 401);
  }

  if (!user.isActive) {
    await recordAuditEvent({
      schoolId: user.schoolId,
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: "LOGIN_FAILED",
      targetType: "User",
      targetId: user.id,
      metadata: { reason: "Account is disabled" },
      req,
    });
    throw new AppError(
      "Account is disabled. Contact school administration.",
      403,
    );
  }

  if (!user.school.isActive) {
    await recordAuditEvent({
      schoolId: user.schoolId,
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: "LOGIN_FAILED",
      targetType: "User",
      targetId: user.id,
      metadata: { reason: "School account is inactive" },
      req,
    });
    throw new AppError("School account is inactive.", 403);
  }

  if (!user.password) {
    throw new AppError(
      "This account uses Google Sign-In. Use the Google button to log in.",
      400,
    );
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    await recordAuditEvent({
      schoolId: user.schoolId,
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: "LOGIN_FAILED",
      targetType: "User",
      targetId: user.id,
      metadata: { reason: "Invalid password" },
      req,
    });
    throw new AppError("Invalid email or password", 401);
  }

  // Generate tokens
  const payload = {
    userId: user.id,
    schoolId: user.schoolId,
    role: user.role,
    email: user.email,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // Store refresh token in DB
  await db.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  // Update last login
  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Log successful login
  await recordAuditEvent({
    schoolId: user.schoolId,
    actorId: user.id,
    actorEmail: user.email,
    actorRole: user.role,
    action: "LOGIN_SUCCESS",
    targetType: "User",
    targetId: user.id,
    metadata: { authProvider: "LOCAL" },
    req,
  });

  return {
    accessToken,
    refreshToken,
    // Return full user profile so front-end has teacher/student relations
    user: await UsersService.getUserById(user.id, user.schoolId),
  };
};

// ── Google OAuth Login ───────────────────────────────────────────────────────
export const googleLogin = async (credential: string, req?: Request) => {
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err: any) {
    throw new AppError("Invalid or expired Google token", 401);
  }

  if (!payload || !payload.email) {
    throw new AppError("Invalid Google credential payload", 401);
  }

  const email = payload.email.toLowerCase();
  const googleId = payload.sub;

  // 1. Look up user by email (read-only)
  const user = await db.user.findFirst({
    where: { email },
    include: {
      school: { select: { id: true, name: true, slug: true, isActive: true } },
    },
  });

  if (!user) {
    throw new AppError(
      "No account found for this email. Contact your school administrator to be added first.",
      403,
    );
  }

  // 2. ROLE CHECK — Admin/SuperAdmin must not sign in via Google
  if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
    await recordAuditEvent({
      schoolId: user.schoolId,
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: "GOOGLE_SIGNIN_BLOCKED_ADMIN",
      targetType: "User",
      targetId: user.id,
      metadata: { role: user.role },
      req,
    });

    throw new AppError(
      "Admin accounts must sign in with email and password. Google Sign-In is not available for this role.",
      403,
    );
  }

  if (!user.isActive) {
    await recordAuditEvent({
      schoolId: user.schoolId,
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: "LOGIN_FAILED",
      targetType: "User",
      targetId: user.id,
      metadata: { reason: "Account is disabled" },
      req,
    });

    throw new AppError(
      "Account is disabled. Contact school administration.",
      403,
    );
  }

  if (!user.school.isActive) {
    await recordAuditEvent({
      schoolId: user.schoolId,
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: "LOGIN_FAILED",
      targetType: "User",
      targetId: user.id,
      metadata: { reason: "School account is inactive" },
      req,
    });

    throw new AppError("School account is inactive.", 403);
  }

  // 3. Link Google account if not linked yet
  if (!user.googleId) {
    await db.user.update({
      where: { id: user.id },
      data: {
        googleId,
        isEmailVerified: true,
      },
    });

    await recordAuditEvent({
      schoolId: user.schoolId,
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: "GOOGLE_ACCOUNT_LINKED",
      targetType: "User",
      targetId: user.id,
      metadata: { googleId },
      req,
    });
  }

  // 4. Generate tokens & login
  const tokenPayload = {
    userId: user.id,
    schoolId: user.schoolId,
    role: user.role,
    email: user.email,
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  await db.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await recordAuditEvent({
    schoolId: user.schoolId,
    actorId: user.id,
    actorEmail: user.email,
    actorRole: user.role,
    action: "LOGIN_SUCCESS",
    targetType: "User",
    targetId: user.id,
    metadata: { authProvider: "GOOGLE" },
    req,
  });

  return {
    accessToken,
    refreshToken,
    user: await UsersService.getUserById(user.id, user.schoolId),
  };
};

// ── Refresh tokens ───────────────────────────────────────────────────────────
export const refreshTokens = async (token: string) => {
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError("Invalid refresh token", 401);
  }

  const stored = await db.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.expiresAt < new Date()) {
    throw new AppError("Refresh token expired or not found", 401);
  }

  // Rotate — delete old, issue new
  await db.refreshToken.delete({ where: { id: stored.id } });

  const newAccessToken = signAccessToken(payload);
  const newRefreshToken = signRefreshToken(payload);

  await db.refreshToken.create({
    data: {
      userId: stored.userId,
      token: newRefreshToken,
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

// ── Logout ───────────────────────────────────────────────────────────────────
export const logout = async (
  userId: string,
  refreshToken?: string,
  req?: Request,
) => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, schoolId: true, email: true, role: true },
  });

  if (refreshToken) {
    await db.refreshToken.deleteMany({ where: { token: refreshToken } });
  } else {
    // Logout all sessions
    await db.refreshToken.deleteMany({ where: { userId } });
  }
  // Clear user cache
  await cacheDel(`user:${userId}`);

  if (user) {
    await recordAuditEvent({
      schoolId: user.schoolId,
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: "LOGOUT",
      targetType: "User",
      targetId: user.id,
      req,
    });
  }
};

// ── Request password reset ───────────────────────────────────────────────────
export const requestPasswordReset = async (email: string) => {
  const user = await db.user.findFirst({ where: { email } });
  if (!user) return; // silently succeed — don't reveal email existence

  const token = generateOpaqueToken();
  await db.passwordReset.create({
    data: {
      userId: user.id,
      token,
      expiresAt: getPasswordResetExpiry(),
    },
  });

  const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
  await sendPasswordResetEmail(
    email,
    `${user.firstName} ${user.lastName}`,
    resetLink,
  );
  logger.info(`Password reset email queued for ${email}`);

  // Token is still returned so callers/tests can exercise the flow without
  // needing a live SMTP connection; the actual delivery path is now the email queue above.
  return token;
};

// ── Reset password ───────────────────────────────────────────────────────────
export const resetPassword = async (token: string, newPassword: string) => {
  const reset = await db.passwordReset.findUnique({ where: { token } });
  if (!reset || reset.expiresAt < new Date() || reset.usedAt) {
    throw new AppError("Reset link is invalid or expired", 400);
  }

  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await db.$transaction([
    db.user.update({ where: { id: reset.userId }, data: { password: hashed } }),
    db.passwordReset.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    }),
    db.refreshToken.deleteMany({ where: { userId: reset.userId } }), // invalidate all sessions
  ]);

  await cacheDel(`user:${reset.userId}`);
};

// ── Change password ──────────────────────────────────────────────────────────
export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
  req?: Request,
) => {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("User not found", 404);

  if (!user.password) {
    throw new AppError(
      "This account uses Google Sign-In and does not have a local password set.",
      400,
    );
  }

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) throw new AppError("Current password is incorrect", 400);

  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await db.user.update({ where: { id: userId }, data: { password: hashed } });
  await cacheDel(`user:${userId}`);

  await recordAuditEvent({
    schoolId: user.schoolId,
    actorId: user.id,
    actorEmail: user.email,
    actorRole: user.role,
    action: "PASSWORD_CHANGED",
    targetType: "User",
    targetId: user.id,
    req,
  });
};
