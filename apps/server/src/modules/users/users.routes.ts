import { Router } from 'express';
import * as UsersController from './users.controller';
import { authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

// Self
router.get('/me', UsersController.getMyProfile);
router.patch('/me', UsersController.updateMyProfile);

// Stats (admin/teacher)
router.get('/stats', authorize(Role.ADMIN, Role.SUPER_ADMIN), UsersController.getSchoolStats);

// ID card (own, or any user for admin/teacher — teachers need this for class ID card runs)
router.get('/me/id-card', UsersController.downloadIdCard);
router.get('/:id/id-card', authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER), UsersController.downloadIdCard);

// Admin CRUD
router.get('/', authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER), UsersController.listUsers);
router.post('/', authorize(Role.ADMIN, Role.SUPER_ADMIN), UsersController.createUser);
router.post('/bulk-students', authorize(Role.ADMIN, Role.SUPER_ADMIN), UsersController.bulkCreateStudents);

router.get('/:id', UsersController.getUser);
router.patch('/:id', authorize(Role.ADMIN, Role.SUPER_ADMIN), UsersController.updateUser);
router.patch('/:id/toggle-status', authorize(Role.ADMIN, Role.SUPER_ADMIN), UsersController.toggleStatus);

export default router;
