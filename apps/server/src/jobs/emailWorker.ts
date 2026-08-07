import { Queue, Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { redisSub } from '../config/redis';
import { logger } from '../utils/logger';

// ── Email Queue ───────────────────────────────────────────────────────────────
export const emailQueue = new Queue('email', { connection: redisSub });

interface EmailJob {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

// ── Transporter ───────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT ?? '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// ── Worker ────────────────────────────────────────────────────────────────────
export const emailWorker = new Worker<EmailJob>(
  'email',
  async (job: Job<EmailJob>) => {
    const { to, subject, html, text, from } = job.data;
    await transporter.sendMail({
      from: from ?? `${process.env.APP_NAME} <${process.env.EMAIL_FROM}>`,
      to: Array.isArray(to) ? to.join(',') : to,
      subject,
      html,
      text,
    });
    logger.info(`Email sent to ${to}: ${subject}`);
  },
  { connection: redisSub, concurrency: 5 },
);

emailWorker.on('failed', (job, err) => logger.error(`Email job ${job?.id} failed:`, err));

// ── Helper to queue emails ────────────────────────────────────────────────────
export const sendEmail = async (data: EmailJob, options?: { delay?: number; attempts?: number }) => {
  await emailQueue.add('send', data, {
    delay: options?.delay,
    attempts: options?.attempts ?? 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
};

// ── Pre-built email templates ─────────────────────────────────────────────────
export const sendWelcomeEmail = (to: string, name: string, role: string, tempPassword?: string) =>
  sendEmail({
    to,
    subject: `Welcome to ${process.env.APP_NAME}!`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#4F46E5">Welcome to TimhirtHub!</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your account has been created as a <strong>${role}</strong>.</p>
        ${tempPassword ? `<p>Your temporary password is: <strong style="background:#f3f4f6;padding:4px 8px;border-radius:4px">${tempPassword}</strong></p><p>Please change it on first login.</p>` : ''}
        <p>Login at: <a href="${process.env.CLIENT_URL}">${process.env.CLIENT_URL}</a></p>
        <hr/>
        <p style="color:#6b7280;font-size:12px">TimhirtHub School Management System</p>
      </div>
    `,
  });

export const sendPasswordResetEmail = (to: string, name: string, resetLink: string) =>
  sendEmail({
    to,
    subject: 'Password Reset Request',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#4F46E5">Password Reset</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>You requested a password reset. Click the link below (valid for 1 hour):</p>
        <a href="${resetLink}" style="display:inline-block;background:#4F46E5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">Reset Password</a>
        <p>If you didn't request this, ignore this email.</p>
      </div>
    `,
  });

export const sendAttendanceAlertEmail = (to: string, parentName: string, studentName: string, date: string, status: string) =>
  sendEmail({
    to,
    subject: `Attendance Alert: ${studentName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#EF4444">Attendance Alert</h2>
        <p>Dear <strong>${parentName}</strong>,</p>
        <p>This is to inform you that <strong>${studentName}</strong> was marked <strong>${status}</strong> on ${date}.</p>
        <p>Please contact the school if you have any questions.</p>
      </div>
    `,
  });

export const sendGradeReportEmail = (to: string, parentName: string, studentName: string, portalLink: string) =>
  sendEmail({
    to,
    subject: `${studentName}'s Report Card is Available`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#4F46E5">Report Card Available</h2>
        <p>Dear <strong>${parentName}</strong>,</p>
        <p><strong>${studentName}</strong>'s term report card is now available.</p>
        <a href="${portalLink}" style="display:inline-block;background:#4F46E5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">View Report Card</a>
      </div>
    `,
  });
