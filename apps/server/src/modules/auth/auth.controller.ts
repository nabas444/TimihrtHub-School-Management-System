import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as AuthService from './auth.service';
import { sendSuccess, sendCreated } from '../../utils/response';

// ── Validation schemas ───────────────────────────────────────────────────────
const RegisterSchema = z.object({
  schoolName: z.string().min(2).max(100),
  schoolEmail: z.string().email(),
  schoolPhone: z.string().optional(),
  adminFirstName: z.string().min(1).max(50),
  adminLastName: z.string().min(1).max(50),
  adminEmail: z.string().email(),
  password: z.string().min(8).max(64),
  country: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  schoolSlug: z.string().optional(),
});

const PasswordResetRequestSchema = z.object({
  email: z.string().email(),
});

const PasswordResetSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8).max(64),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(64),
});

// ── Handlers ─────────────────────────────────────────────────────────────────
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = RegisterSchema.parse(req.body);
    const result = await AuthService.registerSchool(data);
    sendCreated(res, { schoolId: result.school.id, schoolSlug: result.school.slug }, 'School registered successfully');
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email, password, schoolSlug } = LoginSchema.parse(req.body);
    const result = await AuthService.login(email, password, schoolSlug);

    // Set refresh token as HttpOnly cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    sendSuccess(res, { accessToken: result.accessToken, user: result.user }, 'Login successful');
  } catch (err) {
    next(err);
  }
};

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = req.cookies?.refreshToken ?? req.body.refreshToken;
    if (!token) {
      res.status(401).json({ success: false, message: 'Refresh token required' });
      return;
    }
    const tokens = await AuthService.refreshTokens(token);
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    sendSuccess(res, { accessToken: tokens.accessToken });
  } catch (err) {
    next(err);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    await AuthService.logout(req.user.id, refreshToken);
    res.clearCookie('refreshToken');
    sendSuccess(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    sendSuccess(res, req.user);
  } catch (err) {
    next(err);
  }
};

export const requestPasswordReset = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email } = PasswordResetRequestSchema.parse(req.body);
    await AuthService.requestPasswordReset(email);
    sendSuccess(res, null, 'If that email exists, a reset link has been sent.');
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { token, newPassword } = PasswordResetSchema.parse(req.body);
    await AuthService.resetPassword(token, newPassword);
    sendSuccess(res, null, 'Password reset successfully');
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = ChangePasswordSchema.parse(req.body);
    await AuthService.changePassword(req.user.id, currentPassword, newPassword);
    sendSuccess(res, null, 'Password changed successfully');
  } catch (err) {
    next(err);
  }
};
