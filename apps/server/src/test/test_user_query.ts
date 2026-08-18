import "dotenv/config";
import { db } from "../config/database";

async function testChatQuery() {
  const user = await db.user.findFirst({
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
  });

  console.log("Found test user:", user?.id, user?.firstName, user?.role);
}

testChatQuery().finally(() => db.$disconnect());
