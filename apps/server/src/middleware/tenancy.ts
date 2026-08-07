import { Request, Response, NextFunction } from 'express';
import { sendForbidden, sendNotFound } from '../utils/response';
import { db } from '../config/database';
import { cacheGet, cacheSet } from '../config/redis';

// Attach schoolId from authenticated user and verify school is active
export const tenantGuard = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      sendForbidden(res, 'No school context');
      return;
    }

    const cacheKey = `school:active:${schoolId}`;
    let schoolActive = await cacheGet<boolean>(cacheKey);

    if (schoolActive === null) {
      const school = await db.school.findUnique({
        where: { id: schoolId },
        select: { isActive: true },
      });

      if (!school) {
        sendNotFound(res, 'School not found');
        return;
      }

      schoolActive = school.isActive;
      await cacheSet(cacheKey, schoolActive, 600); // cache 10 mins
    }

    if (!schoolActive) {
      sendForbidden(res, 'School account is inactive. Please contact support.');
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
};

// Helper — add schoolId filter to any Prisma query automatically
export const withSchool = (req: Request) => ({
  schoolId: req.user.schoolId,
});
