import { Response } from "express";

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
  errors?: unknown;
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = "Success",
  statusCode = 200,
  meta?: Record<string, unknown>,
): Response =>
  res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta && { meta }),
  });

export const sendCreated = <T>(
  res: Response,
  data: T,
  message = "Created successfully",
): Response => sendSuccess(res, data, message, 201);

export const sendError = (
  res: Response,
  message: string,
  statusCode = 400,
  errors?: unknown,
): Response =>
  res.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
  });

export const sendUnauthorized = (
  res: Response,
  message = "Unauthorized",
): Response => sendError(res, message, 401);

export const sendForbidden = (res: Response, message = "Forbidden"): Response =>
  sendError(res, message, 403);

export const sendNotFound = (res: Response, message = "Not found"): Response =>
  sendError(res, message, 404);

export const paginationMeta = (total: number, page: number, limit: number) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasNext: page * limit < total,
  hasPrev: page > 1,
});
