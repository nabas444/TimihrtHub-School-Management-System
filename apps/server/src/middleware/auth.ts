import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { verifyAccessToken, JwtPayload } from "../utils/jwt";
import { sendUnauthorized, sendForbidden } from "../utils/response";
import { db } from "../config/database";
import { cacheGet, cacheSet } from "../config/redis";

// Extend Express Request with auth context
declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        schoolId: string;
        role: Role;
        email: string;
        firstName: string;
        lastName: string;
      };
    }
  }
}

// ── Authenticate — verify JWT and attach user to request ────────────────────
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : req.cookies?.accessToken;

    if (!token) {
      sendUnauthorized(res, "Access token required");
      return;
    }

    let payload: JwtPayload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      sendUnauthorized(res, "Invalid or expired token");
      return;
    }

    // Check Redis cache first to avoid DB hit on every request
    const cacheKey = `user:${payload.userId}`;
    let user = await cacheGet<typeof req.user>(cacheKey);

    if (!user) {
      const dbUser = await db.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          schoolId: true,
          role: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
        },
      });

      if (!dbUser || !dbUser.isActive) {
        sendUnauthorized(res, "User not found or inactive");
        return;
      }

      user = dbUser;
      await cacheSet(cacheKey, user, 300); // cache 5 mins
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

// ── Authorize — check role(s) ────────────────────────────────────────────────
export const authorize = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendUnauthorized(res);
      return;
    }
    if (!roles.includes(req.user.role)) {
      sendForbidden(res, `Access restricted to: ${roles.join(", ")}`);
      return;
    }
    next();
  };
};

// Shorthand role guards
export const isAdmin = authorize(Role.ADMIN, Role.SUPER_ADMIN);
export const isTeacher = authorize(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN);
export const isParent = authorize(Role.PARENT);
export const isStudent = authorize(Role.STUDENT);
export const isFinance = authorize(Role.FINANCE, Role.ADMIN, Role.SUPER_ADMIN);
export const isStaff = authorize(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN);
