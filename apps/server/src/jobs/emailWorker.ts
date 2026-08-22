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
  try {
    await emailQueue.add('send', data, {
      delay: options?.delay,
      attempts: options?.attempts ?? 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  } catch (err) {
    logger.warn(`Email queue unavailable, skipped background email to ${data.to}:`, err);
  }
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

export const sendApplicationReceivedEmail = (
  to: string,
  studentName: string,
  schoolName: string,
  applicationId: string,
) =>
  sendEmail({
    to,
    subject: `Application Received — ${studentName} (${schoolName})`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#4F46E5">Application Submitted Successfully</h2>
        <p>Dear Parent / Guardian,</p>
        <p>We have received your admission application for <strong>${studentName}</strong> at <strong>${schoolName}</strong>.</p>
        <p>Your Application Reference ID is: <strong style="background:#f3f4f6;padding:4px 8px;border-radius:4px">${applicationId}</strong></p>
        <p>Our admissions committee will review the details and contact you for the next steps.</p>
        <hr/>
        <p style="color:#6b7280;font-size:12px">${schoolName} Admissions</p>
      </div>
    `,
  });

export const sendNewApplicationAlertEmail = (
  to: string | string[],
  studentName: string,
  gradeLevel: string,
  schoolName: string,
  applicationId: string,
) =>
  sendEmail({
    to,
    subject: `New Admission Application: ${studentName} (${gradeLevel || 'Not Specified'})`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#4F46E5">New Student Application Submitted</h2>
        <p>A new admission application has been submitted for <strong>${schoolName}</strong>.</p>
        <ul>
          <li><strong>Applicant:</strong> ${studentName}</li>
          <li><strong>Grade Level:</strong> ${gradeLevel || 'N/A'}</li>
          <li><strong>Application ID:</strong> ${applicationId}</li>
        </ul>
        <p>Please log in to the TimhirtHub Admissions Dashboard to review the application.</p>
        <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/admissions" style="display:inline-block;background:#4F46E5;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;margin:16px 0">Open Admissions CRM</a>
      </div>
    `,
  });

export const sendApplicantAcceptedWelcomeEmail = (
  to: string,
  studentName: string,
  schoolName: string,
  loginEmail: string,
  tempPassword?: string,
) =>
  sendEmail({
    to,
    subject: `🎉 Congratulations! Admission Accepted — ${studentName} (${schoolName})`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#10B981">Admission Accepted!</h2>
        <p>Dear Parent / Guardian,</p>
        <p>We are delighted to inform you that <strong>${studentName}</strong> has been officially accepted into <strong>${schoolName}</strong>!</p>
        <p>A student portal account has been provisioned with the following details:</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
          <p style="margin:4px 0"><strong>Student Name:</strong> ${studentName}</p>
          <p style="margin:4px 0"><strong>Login Email / Username:</strong> ${loginEmail}</p>
          ${tempPassword ? `<p style="margin:4px 0"><strong>Temporary Password:</strong> <span style="background:#e0e7ff;color:#3730a3;padding:2px 6px;border-radius:4px;font-family:monospace">${tempPassword}</span></p>` : ''}
        </div>
        <p>Please log in to complete your enrollment onboarding:</p>
        <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/login" style="display:inline-block;background:#4F46E5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">Log In to Student Portal</a>
        <hr/>
        <p style="color:#6b7280;font-size:12px">${schoolName} · TimhirtHub School Management System</p>
      </div>
    `,
  });
