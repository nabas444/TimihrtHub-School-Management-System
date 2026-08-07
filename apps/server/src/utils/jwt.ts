import * as jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

export interface JwtPayload {
  userId: string;
  schoolId: string;
  role: string;
  email: string;
}

export const signAccessToken = (payload: JwtPayload): string =>
  (jwt.sign as any)(payload, process.env.JWT_ACCESS_SECRET ?? "", {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  });

export const signRefreshToken = (payload: JwtPayload): string =>
  (jwt.sign as any)(payload, process.env.JWT_REFRESH_SECRET ?? "", {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  });

export const verifyAccessToken = (token: string): JwtPayload => {
  return (jwt.verify as any)(
    token,
    process.env.JWT_ACCESS_SECRET ?? "",
  ) as JwtPayload;
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  return (jwt.verify as any)(
    token,
    process.env.JWT_REFRESH_SECRET ?? "",
  ) as JwtPayload;
};

export const generateOpaqueToken = (): string => uuidv4().replace(/-/g, "");

export const getRefreshTokenExpiry = (): Date => {
  const days = parseInt(process.env.JWT_REFRESH_EXPIRES_IN ?? "7") || 7;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

export const getPasswordResetExpiry = (): Date => {
  const d = new Date();
  d.setHours(d.getHours() + 1); // 1 hour
  return d;
};
