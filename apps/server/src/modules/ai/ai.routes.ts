import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { cacheGet, cacheSet } from "../../config/redis";
import { sendSuccess } from "../../utils/response";
import { authorize } from "../../middleware/auth";
import { Role } from "@prisma/client";
import { logger } from "../../utils/logger";

let openai: any = null;

async function getOpenAI() {
  if (!openai) {
    const { default: OpenAI } = await import("openai");
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

// ── Build student context for AI ──────────────────────────────────────────────
const buildStudentContext = async (studentId: string, schoolId: string) => {
  const [user, attendanceSummary, recentGrades, recentBehaviour, assignments] =
    await Promise.all([
      db.user.findFirst({
        where: { id: studentId, schoolId },
        include: {
          studentProfile: {
            include: {
              class: { select: { name: true } },
              gradeLevel: { select: { name: true } },
            },
          },
        },
      }),
      db.attendanceRecord.findMany({
        where: { studentId, schoolId },
        orderBy: { date: "desc" },
        take: 30,
      }),
      db.examResult.findMany({
        where: {
          studentId: (
            await db.studentProfile.findUnique({ where: { userId: studentId } })
          )?.id,
        },
        include: { exam: { include: { subject: true } } },
        take: 10,
        orderBy: { exam: { scheduledAt: "desc" } },
      }),
      db.behaviourRecord.findMany({
        where: { studentId, schoolId },
        take: 10,
        orderBy: { date: "desc" },
      }),
      db.submission.findMany({
        where: { studentId, status: "GRADED" },
        include: { assignment: { include: { subject: true } } },
        take: 10,
      }),
    ]);

  if (!user) throw new AppError("Student not found", 404);

  const attendanceRate =
    attendanceSummary.length > 0
      ? Math.round(
          (attendanceSummary.filter((r) => r.status === "PRESENT").length /
            attendanceSummary.length) *
            100,
        )
      : 0;

  const avgGrade =
    recentGrades.length > 0
      ? Math.round(
          recentGrades.reduce(
            (s, r) => s + (r.marksObtained / r.exam.totalMarks) * 100,
            0,
          ) / recentGrades.length,
        )
      : null;

  return {
    name: `${user.firstName} ${user.lastName}`,
    class: user.studentProfile?.class?.name,
    gradeLevel: user.studentProfile?.gradeLevel?.name,
    attendanceRate,
    avgGrade,
    recentGrades: recentGrades.map((r) => ({
      subject: r.exam.subject.name,
      score: Math.round((r.marksObtained / r.exam.totalMarks) * 100),
      grade: r.grade,
    })),
    behaviourPoints: recentBehaviour.reduce((s, r) => s + r.points, 0),
    recentBehaviour: recentBehaviour.map((r) => ({
      type: r.type,
      title: r.title,
      date: r.date,
    })),
    submissionGrades: assignments.map((s) => ({
      subject: s.assignment.subject.name,
      score:
        s.marksObtained !== null
          ? Math.round((s.marksObtained! / s.assignment.totalMarks) * 100)
          : null,
    })),
  };
};

// ── Generate AI insight for a student ────────────────────────────────────────
const generateStudentInsight = async (studentId: string, schoolId: string) => {
  const cacheKey = `ai:insight:${studentId}`;
  const cached = await cacheGet<object>(cacheKey);
  if (cached) return cached;

  const context = await buildStudentContext(studentId, schoolId);

  const prompt = `You are an educational AI assistant for TimhirtHub school management system.
Analyze this student's academic data and provide structured insights.

Student: ${context.name}
Class: ${context.class} | Grade Level: ${context.gradeLevel}
Attendance Rate: ${context.attendanceRate}%
Average Grade: ${context.avgGrade ?? "N/A"}%
Recent Exam Results: ${JSON.stringify(context.recentGrades)}
Behaviour Points: ${context.behaviourPoints}
Recent Behaviour: ${JSON.stringify(context.recentBehaviour)}
Assignment Scores: ${JSON.stringify(context.submissionGrades)}

Provide a JSON response with:
{
  "summary": "2-3 sentence overall performance summary",
  "strengths": ["strength1", "strength2"],
  "areasForImprovement": ["area1", "area2"],
  "riskLevel": "LOW|MEDIUM|HIGH",
  "riskFactors": ["factor1"],
  "recommendations": ["recommendation1", "recommendation2", "recommendation3"],
  "attendanceAlert": true/false,
  "academicAlert": true/false
}`;

  const openai = await getOpenAI();
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 800,
  });

  const result = JSON.parse(response.choices[0].message.content ?? "{}");

  // Store insight in DB
  const profile = await db.studentProfile.findUnique({
    where: { userId: studentId },
  });
  if (profile) {
    await db.aiInsight.create({
      data: {
        studentProfileId: profile.id,
        type: "PERFORMANCE",
        title: "AI Performance Analysis",
        content: result.summary,
        riskLevel: result.riskLevel,
        score: context.avgGrade,
        metadata: result,
      },
    });
  }

  await cacheSet(cacheKey, result, 3600); // cache 1 hour
  return result;
};

// ── AI chatbot for students/parents ───────────────────────────────────────────
const chatWithAI = async (
  userId: string,
  schoolId: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
) => {
  const user = await db.user.findFirst({
    where: { id: userId, schoolId },
    select: { firstName: true, role: true },
  });

  const systemPrompt = `You are an AI assistant for TimhirtHub school management platform.
You help ${user?.role === "STUDENT" ? "students" : "parents"} understand academic progress, school policies, and general learning questions.
Be encouraging, clear, and age-appropriate. Keep responses concise (under 200 words).
Do not provide medical, legal, or financial advice. Refer serious matters to school staff.
Student name: ${user?.firstName}`;

  const openai = await getOpenAI();
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    max_tokens: 400,
  });

  return { reply: response.choices[0].message.content };
};

// ── Class-wide performance analytics ─────────────────────────────────────────
const getClassInsights = async (classId: string, schoolId: string) => {
  const cacheKey = `ai:class:${classId}`;
  const cached = await cacheGet<object>(cacheKey);
  if (cached) return cached;

  const students = await db.studentProfile.findMany({
    where: { classId, user: { schoolId, isActive: true } },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const results = await db.examResult.findMany({
    where: {
      studentId: { in: students.map((s) => s.id) },
      exam: { class: { schoolId } },
    },
    include: { exam: { include: { subject: { select: { name: true } } } } },
  });

  // Group by subject
  const bySubject = results.reduce<Record<string, number[]>>((acc, r) => {
    const key = r.exam.subject.name;
    if (!acc[key]) acc[key] = [];
    acc[key].push((r.marksObtained / r.exam.totalMarks) * 100);
    return acc;
  }, {});

  const subjectAverages = Object.entries(bySubject).map(
    ([subject, scores]) => ({
      subject,
      average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      passRate: Math.round(
        (scores.filter((s) => s >= 50).length / scores.length) * 100,
      ),
    }),
  );

  const insight = {
    totalStudents: students.length,
    subjectAverages,
    atRisk: 0,
    topPerformers: 0,
  };
  await cacheSet(cacheKey, insight, 1800);
  return insight;
};

// ── Router ────────────────────────────────────────────────────────────────────
const router = Router();
const isStaff = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER];

router.get(
  "/insights/student/:studentId",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!process.env.OPENAI_API_KEY)
        throw new AppError("AI features not configured", 503);
      sendSuccess(
        res,
        await generateStudentInsight(req.params.studentId, req.user.schoolId),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/insights/me",
  authorize(Role.STUDENT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!process.env.OPENAI_API_KEY)
        throw new AppError("AI features not configured", 503);
      sendSuccess(
        res,
        await generateStudentInsight(req.user.id, req.user.schoolId),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/insights/class/:classId",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await getClassInsights(req.params.classId, req.user.schoolId),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/chat",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!process.env.OPENAI_API_KEY)
        throw new AppError("AI features not configured", 503);
      const { messages } = z
        .object({
          messages: z
            .array(
              z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string(),
              }),
            )
            .min(1)
            .max(20),
        })
        .parse(req.body);
      sendSuccess(
        res,
        await chatWithAI(req.user.id, req.user.schoolId, messages),
      );
    } catch (e) {
      next(e);
    }
  },
);

export default router;
