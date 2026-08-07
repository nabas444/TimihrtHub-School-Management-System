import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../config/database';
import { sendSuccess, paginationMeta } from '../../utils/response';

const router = Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;
    const unreadOnly = req.query.unread === 'true';

    const where = { userId: req.user.id, ...(unreadOnly && { isRead: false }) };

    const [notifications, total, unreadCount] = await Promise.all([
      db.notification.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      db.notification.count({ where }),
      db.notification.count({ where: { userId: req.user.id, isRead: false } }),
    ]);

    sendSuccess(res, { notifications, unreadCount }, 'OK', 200, paginationMeta(total, page, limit));
  } catch (e) { next(e); }
});

router.patch('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db.notification.update({
      where: { id: req.params.id, userId: req.user.id },
      data: { isRead: true, readAt: new Date() },
    });
    sendSuccess(res, null, 'Marked as read');
  } catch (e) { next(e); }
});

router.patch('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { count } = await db.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    sendSuccess(res, { updated: count }, `${count} notifications marked as read`);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db.notification.delete({ where: { id: req.params.id, userId: req.user.id } });
    sendSuccess(res, null, 'Deleted');
  } catch (e) { next(e); }
});

export default router;
