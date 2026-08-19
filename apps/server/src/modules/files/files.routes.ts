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

if (CLOUDINARY_ENABLED && CLOUDINARY_URL) {
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

// Helper to extract Cloudinary public ID and resource type from URL
function parseCloudinaryUrl(urlStr: string) {
  try {
    const parsed = new URL(urlStr);
    const parts = parsed.pathname.split("/");
    const uploadIndex = parts.findIndex((p) => p === "upload");
    if (uploadIndex === -1) return null;

    const resourceType = parts[uploadIndex - 1] || "image";
    let remainder = parts.slice(uploadIndex + 1);

    if (remainder[0] && /^v\d+$/.test(remainder[0])) {
      remainder = remainder.slice(1);
    }

    const fullPath = remainder.join("/");
    const ext = path.extname(fullPath).replace(/^\./, "");
    const publicId =
      resourceType === "raw" ? fullPath : fullPath.replace(/\.[^/.]+$/, "");

    return { resourceType, publicId, ext };
  } catch {
    return null;
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
    const parsed = parseCloudinaryUrl(fileUrl);
    if (parsed?.publicId) {
      try {
        await cloudinary.uploader.destroy(parsed.publicId, {
          resource_type: parsed.resourceType,
        });
      } catch (e: any) {
        logger.warn(`Cloudinary destroy error for ${parsed.publicId}:`, e.message);
      }
    }
    return;
  }

  if (process.env.AWS_S3_BUCKET) {
    logger.warn(
      `File ${fileUrl} is stored outside /tmp/uploads, but S3 client is not wired up yet.`,
    );
  }
};

// ── Multer config ────────────────────────────────────────────────────────────
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
      "application/zip",
      "application/x-zip-compressed",
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
          isPublic: z.string().optional(),
        })
        .parse(req.body);

      let fileUrl: string;

      if (CLOUDINARY_ENABLED) {
        const isPdfOrDoc =
          req.file.mimetype.includes("pdf") ||
          req.file.mimetype.includes("msword") ||
          req.file.mimetype.includes("officedocument") ||
          req.file.mimetype.includes("text") ||
          req.file.mimetype.includes("zip");

        const uploadResponse = await cloudinary.uploader.upload(req.file.path, {
          folder: process.env.CLOUDINARY_FOLDER || "timhirthub",
          resource_type: isPdfOrDoc ? "raw" : "auto",
          type: "upload",
          access_mode: "public",
          use_filename: true,
          unique_filename: true,
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

// ── Download file (Authenticated streaming proxy) ──────────────────────────────
router.get(
  "/:id/download",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = await db.file.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId },
      });
      if (!file) throw new AppError("File not found", 404);

      // Check visibility for students/parents
      const isStudentOrParent =
        req.user.role === Role.STUDENT || req.user.role === Role.PARENT;
      if (isStudentOrParent && !file.isPublic) {
        if (file.classId) {
          const sp = await db.studentProfile.findFirst({
            where: { userId: req.user.id, classId: file.classId },
          });
          if (!sp)
            throw new AppError("Not authorized to download this file", 403);
        } else {
          throw new AppError("Not authorized to download this file", 403);
        }
      }

      // 1. Local disk storage
      if (file.url.startsWith("/uploads/")) {
        const filePath = path.join(UPLOAD_DIR, path.basename(file.url));
        return res.download(filePath, file.name);
      }

      // 2. Cloudinary storage
      if (CLOUDINARY_ENABLED && file.url.includes("res.cloudinary.com")) {
        const parsed = parseCloudinaryUrl(file.url);
        let downloadUrl = file.url;

        if (parsed) {
          try {
            downloadUrl = cloudinary.utils.private_download_url(
              parsed.publicId,
              parsed.ext || undefined,
              {
                resource_type: parsed.resourceType as any,
                type: "upload",
                attachment: true,
                expires_at: Math.floor(Date.now() / 1000) + 3600,
              },
            );
          } catch (signErr) {
            logger.warn("Could not sign Cloudinary URL:", signErr);
          }
        }

        try {
          const remoteRes = await fetch(downloadUrl);
          if (remoteRes.ok) {
            res.setHeader(
              "Content-Type",
              file.mimeType || "application/octet-stream",
            );
            res.setHeader(
              "Content-Disposition",
              `attachment; filename="${encodeURIComponent(file.name)}"`,
            );
            if (file.size) {
              res.setHeader("Content-Length", String(file.size));
            }
            const buffer = Buffer.from(await remoteRes.arrayBuffer());
            return res.send(buffer);
          }
        } catch (fetchErr) {
          logger.warn("Failed to stream remote file directly:", fetchErr);
        }

        // Try direct fetch from original file.url with basic auth if needed
        try {
          const remoteRes = await fetch(file.url);
          if (remoteRes.ok) {
            res.setHeader(
              "Content-Type",
              file.mimeType || "application/octet-stream",
            );
            res.setHeader(
              "Content-Disposition",
              `attachment; filename="${encodeURIComponent(file.name)}"`,
            );
            const buffer = Buffer.from(await remoteRes.arrayBuffer());
            return res.send(buffer);
          }
        } catch {}

        return res.redirect(downloadUrl);
      }

      // 3. Generic remote fallback
      try {
        const remoteRes = await fetch(file.url);
        if (remoteRes.ok) {
          res.setHeader(
            "Content-Type",
            file.mimeType || "application/octet-stream",
          );
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${encodeURIComponent(file.name)}"`,
          );
          const buffer = Buffer.from(await remoteRes.arrayBuffer());
          return res.send(buffer);
        }
      } catch {}

      return res.redirect(file.url);
    } catch (e) {
      next(e);
    }
  },
);

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
