import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import multer from "multer";
import path from "path";
import os from "os";
import fs from "fs/promises";
import { v2 as cloudinary } from "cloudinary";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess, sendCreated, paginationMeta } from "../../utils/response";
import { authorize } from "../../middleware/auth";
import { logger } from "../../utils/logger";
import { Role } from "@prisma/client";

const UPLOAD_DIR = path.join(os.tmpdir(), "timhirthub", "uploads");
const CLOUDINARY_URL = process.env.CLOUDINARY_URL?.trim();
const CLOUDINARY_ENABLED = Boolean(CLOUDINARY_URL);

fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(() => null);

if (CLOUDINARY_ENABLED) {
  try {
    const url = new URL(CLOUDINARY_URL);
    const api_key = url.username;
    const api_secret = url.password;
    const cloud_name = url.hostname;

    if (api_key && api_secret && cloud_name) {
      cloudinary.config({
        secure: true,
        api_key,
        api_secret,
        cloud_name,
      });
    } else {
      cloudinary.config({
        secure: true,
        cloudinary_url: CLOUDINARY_URL,
      });
    }
  } catch {
    cloudinary.config({
      secure: true,
      cloudinary_url: CLOUDINARY_URL,
    });
  }
}

const deleteStoredFile = async (fileUrl: string) => {
  if (fileUrl.startsWith("/uploads/")) {
    const filePath = path.join(UPLOAD_DIR, path.basename(fileUrl));
    try {
      await fs.unlink(filePath);
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        logger.warn(
          `Could not remove uploaded file ${filePath}: ${err?.message ?? err}`,
        );
      }
    }
    return;
  }

  if (CLOUDINARY_ENABLED && fileUrl.includes("res.cloudinary.com")) {
    logger.warn(
      `File ${fileUrl} is stored in Cloudinary. Remote deletion is not automatic because the current file schema stores only URL paths. Add public ID tracking to support remote deletes later.`,
    );
    return;
  }

  if (process.env.AWS_S3_BUCKET) {
    logger.warn(
      `File ${fileUrl} looks like it's stored outside /tmp/uploads, but no S3 client is wired up yet — it was not deleted from remote storage. Add an S3 delete call here when the upload path is migrated to S3.`,
    );
  }
};

// ── Multer config (disk storage — swap for S3 in production) ──────────────────
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (_, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "video/mp4",
      "audio/mpeg",
      "text/plain",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`File type ${file.mimetype} not allowed`));
  },
});

const router = Router();
const isStaff: Role[] = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER];

// ── Upload file ───────────────────────────────────────────────────────────────
router.post(
  "/upload",
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError("No file uploaded", 400);

      const { category, classId, subjectId, isPublic } = z
        .object({
          category: z.string().optional(),
          classId: z.string().optional(),
          subjectId: z.string().optional(),
          isPublic: z.string().optional(), // form-data sends strings
        })
        .parse(req.body);

      let fileUrl: string;

      if (CLOUDINARY_ENABLED) {
        const uploadResponse = await cloudinary.uploader.upload(req.file.path, {
          folder: process.env.CLOUDINARY_FOLDER || "timhirthub",
        });
        fileUrl = uploadResponse.secure_url;
        await fs.unlink(req.file.path).catch(() => null);
      } else {
        fileUrl = `/uploads/${req.file.filename}`;
      }

      const file = await db.file.create({
        data: {
          schoolId: req.user.schoolId,
          uploadedById: req.user.id,
          name: req.file.originalname,
          url: fileUrl,
          size: req.file.size,
          mimeType: req.file.mimetype,
          category: category ?? "OTHER",
          classId: classId ?? null,
          subjectId: subjectId ?? null,
          isPublic: isPublic === "true",
        },
      });

      sendCreated(res, file, "File uploaded");
    } catch (e) {
      next(e);
    }
  },
);

// ── List files ────────────────────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const { category, classId, subjectId } = req.query as Record<
      string,
      string | undefined
    >;

    // Students/parents only see public or class-scoped files
    const isStudentOrParent =
      req.user.role === Role.STUDENT || req.user.role === Role.PARENT;
    const visibilityFilter = isStudentOrParent
      ? {
          OR: [
            { isPublic: true },
            { classId: req.query.classId as string | undefined },
          ],
        }
      : {};

    const where = {
      schoolId: req.user.schoolId,
      ...visibilityFilter,
      ...(category && { category }),
      ...(classId && { classId }),
      ...(subjectId && { subjectId }),
    };

    const [files, total] = await Promise.all([
      db.file.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          uploadedBy: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
        },
      }),
      db.file.count({ where }),
    ]);

    sendSuccess(res, files, "OK", 200, paginationMeta(total, page, limit));
  } catch (e) {
    next(e);
  }
});

// ── Delete file ───────────────────────────────────────────────────────────────
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = await db.file.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId },
      });
      if (!file) throw new AppError("File not found", 404);

      const isOwner = file.uploadedById === req.user.id;
      const isAdmin =
        req.user.role === Role.ADMIN || req.user.role === Role.SUPER_ADMIN;
      if (!isOwner && !isAdmin)
        throw new AppError("Not authorized to delete this file", 403);

      await db.file.delete({ where: { id: req.params.id } });
      await deleteStoredFile(file.url);
      sendSuccess(res, null, "File deleted");
    } catch (e) {
      next(e);
    }
  },
);

export default router;
