import { Router } from 'express';
import * as AuthController from './auth.controller';
import { authenticate } from '../../middleware/auth';
import { authLimiter } from '../../middleware/rateLimiter';

const router = Router();

// Public routes
router.post('/register', authLimiter, AuthController.register);
router.post('/login', authLimiter, AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/password/request-reset', authLimiter, AuthController.requestPasswordReset);
router.post('/password/reset', AuthController.resetPassword);

// Protected routes
router.get('/me', authenticate, AuthController.getMe);
router.post('/logout', authenticate, AuthController.logout);
router.post('/password/change', authenticate, AuthController.changePassword);

export default router;
