import { PrismaClient, Role, Gender } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

export async function seedDatabase(client: PrismaClient = db) {
  console.log("🌱 Seeding TimhirtHub database...");

  const hashedPassword = await bcrypt.hash("password123", 12);

  // ── Demo school ────────────────────────────────────────────────────────────
  const school = await db.school.upsert({
    where: { slug: "demo-school" },
    update: {},
    create: {
      name: "Demo International School",
      slug: "demo-school",
      email: "admin@demoschool.edu",
      phone: "+251911234567",
      city: "Addis Ababa",
      country: "Ethiopia",
      settings: { create: {} },
      subscription: {
        create: {
          plan: "STANDARD",
          status: "ACTIVE",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });

  console.log(`✅ School: ${school.name} (${school.id})`);

  // ── Grade levels (Grade 1 to Grade 12) ──────────────────────────────────
  const grades = await Promise.all(
    Array.from({ length: 12 }, (_, i) => i + 1).map((level) =>
      db.gradeLevel.upsert({
        where: { schoolId_level: { schoolId: school.id, level } },
        update: { name: `Grade ${level}` },
        create: { schoolId: school.id, name: `Grade ${level}`, level },
      }),
    ),
  );

  // ── Class ─────────────────────────────────────────────────────────────────
  const classA = await db.class.upsert({
    where: {
      schoolId_name_academicYear: {
        schoolId: school.id,
        name: "10A",
        academicYear: "2024/2025",
      },
    },
    update: {},
    create: {
      schoolId: school.id,
      gradeLevelId: grades[9].id, // Grade 10
      name: "10A",
      academicYear: "2024/2025",
      capacity: 35,
      room: "Room 201",
    },
  });

  // ── Academic term ──────────────────────────────────────────────────────────
  const term = await db.academicTerm.upsert({
    where: { id: "seed-term-1" },
    update: {},
    create: {
      id: "seed-term-1",
      schoolId: school.id,
      name: "Semester 1",
      academicYear: "2024/2025",
      startDate: new Date("2024-09-01"),
      endDate: new Date("2025-01-31"),
      isCurrent: true,
    },
  });

  // ── Subjects ───────────────────────────────────────────────────────────────
  const subjects = await Promise.all(
    [
      { name: "Mathematics", code: "MATH10" },
      { name: "English Language", code: "ENG10" },
      { name: "Biology", code: "BIO10" },
      { name: "Physics", code: "PHY10" },
      { name: "History", code: "HIST10" },
    ].map((s) =>
      db.subject.upsert({
        where: { schoolId_code: { schoolId: school.id, code: s.code } },
        update: {},
        create: { schoolId: school.id, ...s },
      }),
    ),
  );

  // ── Admin user ─────────────────────────────────────────────────────────────
  const admin = await db.user.upsert({
    where: {
      schoolId_email: { schoolId: school.id, email: "admin@demoschool.edu" },
    },
    update: {},
    create: {
      schoolId: school.id,
      role: Role.ADMIN,
      email: "admin@demoschool.edu",
      password: hashedPassword,
      firstName: "Abebe",
      lastName: "Girma",
      phone: "+251911111111",
      isEmailVerified: true,
      adminProfile: { create: { employeeId: "ADM001", isSuperAdmin: true } },
    },
  });

  // ── Teacher user ───────────────────────────────────────────────────────────
  const teacherEmail = "versenova.ai@gmail.com";
  const existingOldTeacher = await db.user.findFirst({
    where: { schoolId: school.id, email: "teacher@demoschool.edu" },
  });
  if (existingOldTeacher) {
    await db.user.update({
      where: { id: existingOldTeacher.id },
      data: { email: teacherEmail, password: hashedPassword },
    });
  }

  const teacher = await db.user.upsert({
    where: {
      schoolId_email: { schoolId: school.id, email: teacherEmail },
    },
    update: {
      password: hashedPassword,
    },
    create: {
      schoolId: school.id,
      role: Role.TEACHER,
      email: teacherEmail,
      password: hashedPassword,
      firstName: "Tigist",
      lastName: "Bekele",
      gender: Gender.FEMALE,
      isEmailVerified: true,
      teacherProfile: {
        create: {
          employeeId: "TCH001",
          qualification: "MSc Mathematics",
          isClassTeacher: true,
          assignedClasses: { connect: { id: classA.id } },
        },
      },
    },
  });

  // ── Student user ───────────────────────────────────────────────────────────
  const studentEmail = "abenezerabebe848@gmail.com";
  const existingOldStudent = await db.user.findFirst({
    where: { schoolId: school.id, email: "student@demoschool.edu" },
  });
  if (existingOldStudent) {
    await db.user.update({
      where: { id: existingOldStudent.id },
      data: { email: studentEmail, password: hashedPassword },
    });
  }

  const student = await db.user.upsert({
    where: {
      schoolId_email: { schoolId: school.id, email: studentEmail },
    },
    update: {
      password: hashedPassword,
    },
    create: {
      schoolId: school.id,
      role: Role.STUDENT,
      email: studentEmail,
      password: hashedPassword,
      firstName: "Dawit",
      lastName: "Haile",
      gender: Gender.MALE,
      isEmailVerified: true,
      studentProfile: {
        create: {
          admissionNumber: "STU2024001",
          rollNumber: "01",
          classId: classA.id,
          gradeLevelId: grades[3].id,
        },
      },
    },
  });

  // ── Parent user ────────────────────────────────────────────────────────────
  const parentEmail = "yeshiworkmoges3730@gmail.com";
  const existingOldParent = await db.user.findFirst({
    where: { schoolId: school.id, email: "parent@demoschool.edu" },
  });
  if (existingOldParent) {
    await db.user.update({
      where: { id: existingOldParent.id },
      data: { email: parentEmail, password: hashedPassword },
    });
  }

  const parent = await db.user.upsert({
    where: {
      schoolId_email: { schoolId: school.id, email: parentEmail },
    },
    update: {
      password: hashedPassword,
    },
    create: {
      schoolId: school.id,
      role: Role.PARENT,
      email: parentEmail,
      password: hashedPassword,
      firstName: "Haile",
      lastName: "Tadesse",
      phone: "+251922222222",
      isEmailVerified: true,
      parentProfile: {
        create: { occupation: "Engineer", relation: "Father" },
      },
    },
  });

  // Link parent to student
  const studentProfile = await db.studentProfile.findUnique({
    where: { userId: student.id },
  });
  const parentProfile = await db.parentProfile.findUnique({
    where: { userId: parent.id },
  });
  if (studentProfile && parentProfile) {
    await db.parentStudentLink.upsert({
      where: {
        parentProfileId_studentProfileId: {
          parentProfileId: parentProfile.id,
          studentProfileId: studentProfile.id,
        },
      },
      update: {},
      create: {
        parentProfileId: parentProfile.id,
        studentProfileId: studentProfile.id,
        relation: "Father",
        isPrimary: true,
      },
    });
  }

  console.log("✅ Seed users created:");
  console.log("   Admin:   admin@demoschool.edu        / password123");
  console.log("   Teacher: versenova.ai@gmail.com      / password123");
  console.log("   Student: abenezerabebe848@gmail.com   / password123");
  console.log("   Parent:  yeshiworkmoges3730@gmail.com / password123");

  const finance = await db.user.upsert({
    where: {
      schoolId_email: { schoolId: school.id, email: "finance@demoschool.edu" },
    },
    update: {},
    create: {
      schoolId: school.id,
      role: Role.FINANCE,
      email: "finance@demoschool.edu",
      password: hashedPassword,
      firstName: "Fikir",
      lastName: "Kebede",
      phone: "+251933333333",
      isEmailVerified: true,
    },
  });

  console.log("   Finance: finance@demoschool.edu / password123");
  console.log("🎉 Seed complete!");
}

if (require.main === module) {
  seedDatabase()
    .catch((e) => {
      console.error("Seed failed:", e);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
