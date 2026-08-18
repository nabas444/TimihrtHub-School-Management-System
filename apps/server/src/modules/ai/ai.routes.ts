import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { cacheGet, cacheSet } from "../../config/redis";
import { sendSuccess } from "../../utils/response";
import { authorize } from "../../middleware/auth";
import { Role } from "@prisma/client";
import { logger } from "../../utils/logger";

// ── Supported Gemini Models in Order of Preference ───────────────────────────
const GEMINI_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
];

// ── Resolve AI Provider & Key ────────────────────────────────────────────────
const getAiConfig = (): { key: string; provider: "gemini" | "openai" } | null => {
  const geminiKey =
    process.env.Gemini_API_Key ||
    process.env.GEMINI_API_KEY ||
    process.env.gemini_api_key ||
    process.env.GOOGLE_API_KEY;

  if (geminiKey && !geminiKey.includes("...")) {
    return { key: geminiKey.trim(), provider: "gemini" };
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && openaiKey.startsWith("sk-") && !openaiKey.includes("...")) {
    return { key: openaiKey.trim(), provider: "openai" };
  }

  if (geminiKey) return { key: geminiKey.trim(), provider: "gemini" };
  if (openaiKey) return { key: openaiKey.trim(), provider: "openai" };

  return null;
};

// ── Google Gemini REST API Client ─────────────────────────────────────────────
async function callGemini(
  apiKey: string,
  systemInstruction: string,
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  jsonMode: boolean = false,
): Promise<string> {
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  if (contents.length === 0) {
    contents.push({ role: "user", parts: [{ text: "Hello" }] });
  }

  let lastError: any = null;

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const body: any = {
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: jsonMode ? 1200 : 800,
          ...(jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      };

      if (systemInstruction) {
        body.systemInstruction = {
          parts: [{ text: systemInstruction }],
        };
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn(`Gemini (${model}) returned status ${response.status}: ${errorText}`);
        lastError = new Error(`Gemini error (${response.status}): ${errorText}`);
        continue;
      }

      const data: any = await response.json();
      const text =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        data.candidates?.[0]?.text;

      if (text) {
        return text;
      }
    } catch (err: any) {
      logger.warn(`Gemini (${model}) fetch error:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to generate AI response from Gemini");
}

// ── OpenAI API Client Fallback ────────────────────────────────────────────────
async function callOpenAI(
  apiKey: string,
  systemInstruction: string,
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  jsonMode: boolean = false,
): Promise<string> {
  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      ...(systemInstruction ? [{ role: "system" as const, content: systemInstruction }] : []),
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
    ],
    max_tokens: jsonMode ? 1000 : 600,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
  });

  return completion.choices[0]?.message?.content ?? "";
}

// ── Unified AI Completion Generator ──────────────────────────────────────────
async function generateAIResponse(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  jsonMode: boolean = false,
): Promise<string> {
  const config = getAiConfig();
  if (!config) {
    throw new AppError(
      "AI features are not configured. Please add Gemini_API_Key to your server .env file.",
      503,
    );
  }

  if (config.provider === "gemini") {
    return await callGemini(config.key, systemPrompt, messages, jsonMode);
  } else {
    return await callOpenAI(config.key, systemPrompt, messages, jsonMode);
  }
}

// Helper to strip markdown code blocks and safely parse JSON
function parseAIJson<T>(rawText: string, fallback: T): T {
  try {
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    return JSON.parse(cleaned);
  } catch (err) {
    logger.warn("Failed to parse AI JSON response, using fallback:", err);
    return fallback;
  }
}

// ── TimhirtHub System Knowledge Base Prompt ──────────────────────────────────
const TIMHIRTHUB_KNOWLEDGE = `
You are the official intelligent AI Assistant for TimhirtHub — a modern, full-stack School Management Platform connecting Students, Teachers, Parents, Finance, and Administrators.

You possess in-depth knowledge of all system features, workflows, and modules:

1. ACADEMICS & CURRICULUM:
   - Manage classes, grade levels, subjects, and curriculum.
   - Assignments: Teachers create assignments; students submit online; teachers grade and provide feedback.
   - Exams & Grading: Exam scheduling, max marks, marks entry, automated grade calculation, and downloadable PDF report cards.

2. ATTENDANCE TRACKING:
   - Daily attendance recording (Present, Absent, Late, Excused).
   - Automated attendance summaries, percentage calculations, and absence notifications for parents.

3. FEES & INVOICING (School Level):
   - Invoices generated for tuition, uniform, exams, transport, and library fees.
   - Tracking pending, partial, and paid statuses.
   - Payment methods supported: Cash, Bank Transfer, Stripe, and M-Pesa.
   - Digital printable payment receipts with school branding.

4. SAAS BILLING & SUBSCRIPTIONS (Platform Level):
   - School plans: Free ($0/mo, 50 students), Basic ($29/mo, 200 students), Standard ($79/mo, 1000 students), Enterprise ($199/mo, unlimited students).
   - Powered by Stripe Checkout and Customer Billing Portal for managing payment methods and invoices.

5. TIMETABLE & SCHEDULE:
   - Interactive weekly timetable builder for classes and teachers with conflict detection.

6. BEHAVIOUR & DISCIPLINE:
   - Tracking positive points (merits) and incidents (demerits), with parent visibility.

7. LIBRARY SYSTEM:
   - Book cataloging, ISBN lookup, borrowing records, due date tracking, and fine management.

8. STAFF & PAYROLL:
   - Teacher profiles, leave requests and approvals, payroll records, and salary tracking.

9. COMMUNICATION & MEETINGS:
   - Real-time Direct & Group Chat between teachers, students, parents, and admins.
   - School-wide announcements with broadcast notifications.
   - Parent-Teacher meeting scheduling.

10. AI INSIGHTS & ANALYTICS:
   - Student academic risk detection, strengths identification, attendance warnings, and personalized learning guidance.

When answering users:
- Be friendly, concise, highly accurate, and helpful.
- Guide users on how to use features and where to find them in the TimhirtHub navigation menu (e.g. Settings → Billing, Academics → Exams, Fees, Timetable, etc.).
- When student or school context is provided, personalize your advice directly using their data.
`;

// ── Build student context for AI ──────────────────────────────────────────────
const buildStudentContext = async (studentId: string, schoolId: string) => {
  let user = await db.user.findFirst({
    where: { id: studentId, schoolId },
    include: {
      studentProfile: {
        include: {
          class: { select: { name: true } },
          gradeLevel: { select: { name: true } },
        },
      },
    },
  });

  let studentProfileId = user?.studentProfile?.id;

  if (!user || !studentProfileId) {
    const sp = await db.studentProfile.findFirst({
      where: { id: studentId, user: { schoolId } },
      include: {
        user: true,
        class: { select: { name: true } },
        gradeLevel: { select: { name: true } },
      },
    });
    if (sp) {
      user = sp.user as any;
      studentProfileId = sp.id;
    }
  }

  if (!user) throw new AppError("Student not found", 404);

  const [attendanceSummary, recentGrades, recentBehaviour, assignments] =
    await Promise.all([
      db.attendanceRecord.findMany({
        where: { studentId: user.id, schoolId },
        orderBy: { date: "desc" },
        take: 30,
      }),
      studentProfileId
        ? db.examResult.findMany({
            where: { studentId: studentProfileId },
            include: { exam: { include: { subject: true } } },
            take: 10,
            orderBy: { exam: { scheduledAt: "desc" } },
          })
        : [],
      db.behaviourRecord.findMany({
        where: { studentId: user.id, schoolId },
        take: 10,
        orderBy: { date: "desc" },
      }),
      db.submission.findMany({
        where: { studentId: user.id, status: "GRADED" },
        include: { assignment: { include: { subject: true } } },
        take: 10,
      }),
    ]);

  const attendanceRate =
    attendanceSummary.length > 0
      ? Math.round(
          (attendanceSummary.filter((r) => r.status === "PRESENT").length /
            attendanceSummary.length) *
            100,
        )
      : 0;

  const validGrades = recentGrades.filter(
    (r) => r.exam?.totalMarks && r.exam.totalMarks > 0,
  );
  const avgGrade =
    validGrades.length > 0
      ? Math.round(
          validGrades.reduce(
            (s, r) => s + (r.marksObtained / r.exam.totalMarks) * 100,
            0,
          ) / validGrades.length,
        )
      : null;

  return {
    userId: user.id,
    studentProfileId,
    name: `${user.firstName} ${user.lastName}`,
    class: user.studentProfile?.class?.name ?? "General",
    gradeLevel: user.studentProfile?.gradeLevel?.name ?? "General",
    attendanceRate,
    avgGrade,
    recentGrades: validGrades.map((r) => ({
      subject: r.exam.subject?.name ?? "Subject",
      score: Math.round((r.marksObtained / r.exam.totalMarks) * 100),
      grade: r.grade ?? "N/A",
    })),
    behaviourPoints: recentBehaviour.reduce((s, r) => s + (r.points ?? 0), 0),
    recentBehaviour: recentBehaviour.map((r) => ({
      type: r.type,
      title: r.title,
      date: r.date,
    })),
    submissionGrades: assignments.map((s) => ({
      subject: s.assignment?.subject?.name ?? "Assignment",
      score:
        s.marksObtained !== null && s.assignment?.totalMarks
          ? Math.round((s.marksObtained / s.assignment.totalMarks) * 100)
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

  const defaultInsight = {
    summary: `${context.name} maintains an attendance rate of ${context.attendanceRate}% and an average grade of ${context.avgGrade ?? "N/A"}%. Performance is stable with steady engagement in class activities.`,
    strengths: [
      context.attendanceRate >= 80
        ? "Consistent class attendance"
        : "Active participation in coursework",
      "Regular assignment completion",
    ],
    areasForImprovement: [
      context.attendanceRate < 80
        ? "Improve attendance and punctuality"
        : "Target higher exam preparation consistency",
      "Focus on continuous subject revision",
    ],
    riskLevel:
      context.attendanceRate < 70 ||
      (context.avgGrade !== null && context.avgGrade < 50)
        ? "HIGH"
        : context.attendanceRate < 85 ||
            (context.avgGrade !== null && context.avgGrade < 65)
          ? "MEDIUM"
          : "LOW",
    riskFactors: context.attendanceRate < 75 ? ["Attendance below target"] : [],
    recommendations: [
      "Review weekly class lecture notes and textbook summaries",
      "Engage actively in classroom discussions and ask questions",
      "Practice past exam problems and assignment reviews",
    ],
    attendanceAlert: context.attendanceRate < 75,
    academicAlert: context.avgGrade !== null && context.avgGrade < 50,
  };

  let result = defaultInsight;

  try {
    const systemPrompt = `${TIMHIRTHUB_KNOWLEDGE}
You are analyzing student academic, attendance, and behavioral data.
Output ONLY valid JSON matching this schema:
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

    const userPrompt = `Student Data:
Name: ${context.name}
Class: ${context.class} | Grade Level: ${context.gradeLevel}
Attendance Rate: ${context.attendanceRate}%
Average Grade: ${context.avgGrade ?? "N/A"}%
Recent Exam Results: ${JSON.stringify(context.recentGrades)}
Behaviour Points: ${context.behaviourPoints}
Recent Behaviour: ${JSON.stringify(context.recentBehaviour)}
Assignment Scores: ${JSON.stringify(context.submissionGrades)}`;

    const rawResponse = await generateAIResponse(
      systemPrompt,
      [{ role: "user", content: userPrompt }],
      true,
    );

    result = parseAIJson(rawResponse, defaultInsight);
  } catch (err) {
    logger.warn("AI generation failed, using default insight:", err);
  }

  // Store insight in DB if profile exists
  if (context.studentProfileId) {
    try {
      await db.aiInsight.create({
        data: {
          studentProfileId: context.studentProfileId,
          type: "PERFORMANCE",
          title: "AI Performance Analysis",
          content: result.summary,
          riskLevel: result.riskLevel,
          score: context.avgGrade,
          metadata: result,
        },
      });
    } catch (dbErr) {
      logger.warn("Could not save aiInsight to database:", dbErr);
    }
  }

  await cacheSet(cacheKey, result, 3600); // cache 1 hour
  return result;
};

// ── AI chatbot for students/parents/staff ─────────────────────────────────────
const chatWithAI = async (
  userId: string,
  schoolId: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
) => {
  const [user, school] = await Promise.all([
    db.user.findFirst({
      where: { id: userId, schoolId },
      include: {
        studentProfile: {
          include: {
            class: { select: { name: true } },
            gradeLevel: { select: { name: true } },
          },
        },
        teacherProfile: {
          include: {
            subjectTeachings: {
              include: {
                subject: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    db.school.findUnique({
      where: { id: schoolId },
      select: { name: true },
    }),
  ]);

  const role = user?.role ?? "USER";
  const fullName = user ? `${user.firstName} ${user.lastName}` : "User";
  const schoolName = school?.name ?? "TimhirtHub School";

  let userContext = `Current User Context:
- Name: ${fullName}
- Role: ${role}
- School: ${schoolName}`;

  if (user?.studentProfile) {
    userContext += `\n- Enrolled Class: ${user.studentProfile.class?.name ?? "N/A"}`;
    userContext += `\n- Grade Level: ${user.studentProfile.gradeLevel?.name ?? "N/A"}`;
  }

  if (user?.teacherProfile?.subjectTeachings?.length) {
    const subjects = user.teacherProfile.subjectTeachings
      .map((st: any) => st.subject?.name)
      .filter(Boolean)
      .join(", ");
    if (subjects) {
      userContext += `\n- Teaching Subject(s): ${subjects}`;
    }
  }

  const systemPrompt = `${TIMHIRTHUB_KNOWLEDGE}

${userContext}

Instructions:
- Greet the user by their name (${user?.firstName || "there"}).
- Provide insightful, accurate answers about TimhirtHub features, school navigation, coursework, study strategies, or academic guidance.
- Keep responses engaging, structured, and easy to read.
- If asked about navigating TimhirtHub (e.g., how to check fees, exams, timetable, attendance, or billing), give direct step-by-step instructions.`;

  const reply = await generateAIResponse(
    systemPrompt,
    messages.map((m) => ({ role: m.role, content: m.content })),
    false,
  );

  return { reply };
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

  const bySubject = results.reduce<Record<string, number[]>>((acc, r) => {
    const key = r.exam?.subject?.name ?? "General";
    if (!acc[key]) acc[key] = [];
    if (r.exam?.totalMarks && r.exam.totalMarks > 0) {
      acc[key].push((r.marksObtained / r.exam.totalMarks) * 100);
    }
    return acc;
  }, {});

  const subjectAverages = Object.entries(bySubject).map(
    ([subject, scores]) => ({
      subject,
      average:
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0,
      passRate:
        scores.length > 0
          ? Math.round(
              (scores.filter((s) => s >= 50).length / scores.length) * 100,
            )
          : 0,
    }),
  );

  const insight = {
    totalStudents: students.length,
    subjectAverages,
    atRisk: subjectAverages.filter((s) => s.average < 50).length,
    topPerformers: subjectAverages.filter((s) => s.average >= 85).length,
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
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
