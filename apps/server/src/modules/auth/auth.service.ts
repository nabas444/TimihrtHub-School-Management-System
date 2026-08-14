import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
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
import * as UsersService from "../users/users.service";

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS ?? "12");

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

  if (!user) throw new AppError("Invalid email or password", 401);
  if (!user.isActive)
    throw new AppError(
      "Account is disabled. Contact school administration.",
      403,
    );
  if (!user.school.isActive)
    throw new AppError("School account is inactive.", 403);

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new AppError("Invalid email or password", 401);

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

  return {
    accessToken,
    refreshToken,
    // Return full user profile so front-end has teacher/student relations
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
export const logout = async (userId: string, refreshToken?: string) => {
  if (refreshToken) {
    await db.refreshToken.deleteMany({ where: { token: refreshToken } });
  } else {
    // Logout all sessions
    await db.refreshToken.deleteMany({ where: { userId } });
  }
  // Clear user cache
  await cacheDel(`user:${userId}`);
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
) => {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("User not found", 404);

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) throw new AppError("Current password is incorrect", 400);

  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await db.user.update({ where: { id: userId }, data: { password: hashed } });
  await cacheDel(`user:${userId}`);
};
