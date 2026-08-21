/**
 * TimhirtHub Club Management Service
 * Models real-world school extracurricular clubs, faculty advisors,
 * student leadership, membership, meetings, events, RSVPs, attendance,
 * activities/projects, announcements, documents, and academic-year renewal.
 */

import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { emitToUser } from "../../config/socket";
import { NotificationType, Role } from "@prisma/client";
import { formatInSchoolTimezone } from "../../utils/deadlines";

function safeEmitToUser(userId: string, event: string, payload: any) {
  try {
    emitToUser(userId, event, payload);
  } catch (err) {
    // Socket might not be active in test scripts
  }
}

export type ClubStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "ACTIVE"
  | "SUSPENDED"
  | "RENEWAL_REQUIRED"
  | "ARCHIVED"
  | "REJECTED";

export type ClubCategory =
  | "ACADEMIC"
  | "SCIENCE"
  | "TECHNOLOGY"
  | "MATHEMATICS"
  | "ARTS"
  | "MUSIC"
  | "SPORTS"
  | "DEBATE"
  | "CULTURE"
  | "ENTREPRENEURSHIP"
  | "COMMUNITY_SERVICE"
  | "ENVIRONMENT"
  | "OTHER";

export type LeadershipRole =
  | "PRESIDENT"
  | "VICE_PRESIDENT"
  | "SECRETARY"
  | "TREASURER"
  | "PUBLIC_RELATIONS"
  | "OTHER";

export type MembershipStatus =
  | "REQUESTED"
  | "ACTIVE"
  | "REJECTED"
  | "LEFT"
  | "REMOVED";

export type EventStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "PUBLISHED"
  | "COMPLETED"
  | "CANCELLED";

let tablesInitialized = false;

export async function ensureClubTables() {
  if (tablesInitialized) return;
  try {
    // 1. Clubs table
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS clubs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        name VARCHAR NOT NULL,
        code VARCHAR,
        description TEXT,
        purpose TEXT,
        category VARCHAR NOT NULL DEFAULT 'OTHER',
        academic_year VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'PENDING_APPROVAL',
        advisor_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        created_by_id VARCHAR NOT NULL REFERENCES users(id),
        expected_membership INT DEFAULT 20,
        preferred_meeting_schedule VARCHAR,
        meeting_location VARCHAR,
        logo_url TEXT,
        banner_url TEXT,
        rejection_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_clubs_school_status ON clubs (school_id, status)
    `);

    // 2. Club Memberships
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS club_memberships (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        club_id VARCHAR NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        student_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR NOT NULL DEFAULT 'REQUESTED',
        role VARCHAR NOT NULL DEFAULT 'MEMBER',
        request_notes TEXT,
        join_date TIMESTAMPTZ DEFAULT NOW(),
        end_date TIMESTAMPTZ,
        academic_year VARCHAR NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT club_member_unique UNIQUE (club_id, student_id, academic_year)
      )
    `);

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_club_members_school_club ON club_memberships (school_id, club_id)
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_club_members_student ON club_memberships (student_id)
    `);

    // 3. Club Leaderships (Historical tracking)
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS club_leaderships (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        club_id VARCHAR NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        student_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR NOT NULL DEFAULT 'PRESIDENT',
        academic_year VARCHAR NOT NULL,
        start_date TIMESTAMPTZ DEFAULT NOW(),
        end_date TIMESTAMPTZ,
        status VARCHAR DEFAULT 'ACTIVE',
        assigned_by_id VARCHAR NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_club_leaders_club ON club_leaderships (club_id, status)
    `);

    // 4. Club Meetings
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS club_meetings (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        club_id VARCHAR NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        title VARCHAR NOT NULL,
        description TEXT,
        date DATE NOT NULL,
        start_time VARCHAR NOT NULL,
        end_time VARCHAR NOT NULL,
        location VARCHAR NOT NULL,
        recurrence VARCHAR DEFAULT 'NONE',
        status VARCHAR DEFAULT 'SCHEDULED',
        organizer_id VARCHAR NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_club_meetings_club_date ON club_meetings (club_id, date)
    `);

    // 5. Club Events
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS club_events (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        club_id VARCHAR NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        title VARCHAR NOT NULL,
        description TEXT,
        event_type VARCHAR NOT NULL DEFAULT 'WORKSHOP',
        date DATE NOT NULL,
        start_time VARCHAR NOT NULL,
        end_time VARCHAR NOT NULL,
        location VARCHAR NOT NULL,
        capacity INT DEFAULT 0,
        audience VARCHAR DEFAULT 'CLUB_MEMBERS',
        status VARCHAR DEFAULT 'SUBMITTED',
        organizer_id VARCHAR NOT NULL REFERENCES users(id),
        attachment_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_club_events_club ON club_events (club_id, date)
    `);

    // 6. Club Event RSVPs
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS club_event_rsvps (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        event_id VARCHAR NOT NULL REFERENCES club_events(id) ON DELETE CASCADE,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR DEFAULT 'REGISTERED',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT club_event_rsvp_unique UNIQUE (event_id, user_id)
      )
    `);

    // 7. Club Attendance Records
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS club_attendance_records (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        club_id VARCHAR NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        meeting_id VARCHAR REFERENCES club_meetings(id) ON DELETE CASCADE,
        event_id VARCHAR REFERENCES club_events(id) ON DELETE CASCADE,
        student_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'PRESENT',
        marked_by_id VARCHAR NOT NULL REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT club_attendance_unique UNIQUE (club_id, meeting_id, student_id)
      )
    `);

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_club_att_student ON club_attendance_records (student_id, date)
    `);

    // 8. Club Activities & Projects Portfolio
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS club_activities (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        club_id VARCHAR NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        event_id VARCHAR REFERENCES club_events(id) ON DELETE SET NULL,
        title VARCHAR NOT NULL,
        description TEXT,
        date DATE NOT NULL,
        outcome TEXT,
        participants_count INT DEFAULT 0,
        attachment_url TEXT,
        media_urls JSONB DEFAULT '[]',
        created_by_id VARCHAR NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 9. Club Announcements
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS club_announcements (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        club_id VARCHAR NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        title VARCHAR NOT NULL,
        content TEXT NOT NULL,
        priority VARCHAR DEFAULT 'NORMAL',
        is_pinned BOOLEAN DEFAULT FALSE,
        author_id VARCHAR NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 10. Club Documents
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS club_documents (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        club_id VARCHAR NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        name VARCHAR NOT NULL,
        category VARCHAR DEFAULT 'OTHER',
        file_url TEXT NOT NULL,
        file_size INT DEFAULT 0,
        mime_type VARCHAR DEFAULT 'application/pdf',
        uploaded_by_id VARCHAR NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 11. Club Goals
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS club_goals (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        club_id VARCHAR NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        title VARCHAR NOT NULL,
        description TEXT,
        target_count INT NOT NULL DEFAULT 1,
        current_count INT NOT NULL DEFAULT 0,
        unit VARCHAR DEFAULT 'milestones',
        status VARCHAR DEFAULT 'IN_PROGRESS',
        academic_year VARCHAR NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    tablesInitialized = true;
  } catch (err) {
    console.error("Failed to initialize club tables:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CLUBS DIRECTORY, SEARCH & DETAILS
// ─────────────────────────────────────────────────────────────────────────────

export async function getClubs(
  schoolId: string,
  userId: string,
  userRole: string,
  filters: {
    search?: string;
    category?: string;
    status?: string;
    academicYear?: string;
  } = {},
) {
  await ensureClubTables();

  let query = `
    SELECT
      c.*,
      u."firstName" as advisor_first_name,
      u."lastName" as advisor_last_name,
      u."email" as advisor_email,
      u."avatar" as advisor_avatar,
      cb."firstName" as creator_first_name,
      cb."lastName" as creator_last_name,
      (SELECT COUNT(*)::int FROM club_memberships cm WHERE cm.club_id = c.id AND cm.status = 'ACTIVE') as member_count,
      (SELECT COUNT(*)::int FROM club_events ce WHERE ce.club_id = c.id AND ce.status IN ('APPROVED', 'PUBLISHED') AND ce.date >= CURRENT_DATE) as upcoming_events_count,
      (SELECT status FROM club_memberships cm WHERE cm.club_id = c.id AND cm.student_id = $2 ORDER BY cm.created_at DESC LIMIT 1) as my_membership_status,
      (SELECT role FROM club_memberships cm WHERE cm.club_id = c.id AND cm.student_id = $2 AND cm.status = 'ACTIVE' LIMIT 1) as my_club_role
    FROM clubs c
    LEFT JOIN users u ON c.advisor_id = u.id
    LEFT JOIN users cb ON c.created_by_id = cb.id
    WHERE c.school_id = $1
  `;
  const params: any[] = [schoolId, userId];

  // Role visibility filter: Students only see ACTIVE clubs unless they are creator or member
  if (userRole === "STUDENT") {
    if (!filters.status) {
      query += ` AND (c.status = 'ACTIVE' OR c.created_by_id = $2 OR EXISTS (SELECT 1 FROM club_memberships cm WHERE cm.club_id = c.id AND cm.student_id = $2))`;
    } else {
      params.push(filters.status);
      query += ` AND c.status = $${params.length}`;
    }
  } else if (filters.status && filters.status !== "ALL") {
    params.push(filters.status);
    query += ` AND c.status = $${params.length}`;
  }

  if (filters.category && filters.category !== "ALL") {
    params.push(filters.category);
    query += ` AND c.category = $${params.length}`;
  }

  if (filters.academicYear && filters.academicYear !== "ALL") {
    params.push(filters.academicYear);
    query += ` AND c.academic_year = $${params.length}`;
  }

  if (filters.search) {
    params.push(`%${filters.search.trim().toLowerCase()}%`);
    query += ` AND (LOWER(c.name) LIKE $${params.length} OR LOWER(c.description) LIKE $${params.length} OR LOWER(c.purpose) LIKE $${params.length})`;
  }

  query += ` ORDER BY c.status = 'ACTIVE' DESC, c.created_at DESC`;

  const rows: any[] = await db.$queryRawUnsafe(query, ...params);

  // Fetch active leaders for each club
  const clubIds = rows.map((r) => r.id);
  let leadersMap = new Map<string, any[]>();
  if (clubIds.length > 0) {
    const leaderRows: any[] = await db.$queryRawUnsafe(
      `
      SELECT
        cl.*,
        u."firstName" as first_name,
        u."lastName" as last_name,
        u."email" as email,
        u."avatar" as avatar
      FROM club_leaderships cl
      JOIN users u ON cl.student_id = u.id
      WHERE cl.club_id = ANY($1::varchar[]) AND cl.status = 'ACTIVE'
      ORDER BY cl.created_at ASC
    `,
      clubIds,
    );
    for (const l of leaderRows) {
      if (!leadersMap.has(l.club_id)) leadersMap.set(l.club_id, []);
      leadersMap.get(l.club_id)!.push({
        id: l.id,
        studentId: l.student_id,
        role: l.role,
        academicYear: l.academic_year,
        student: {
          firstName: l.first_name,
          lastName: l.last_name,
          email: l.email,
          avatar: l.avatar,
        },
      });
    }
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    description: r.description,
    purpose: r.purpose,
    category: r.category,
    academicYear: r.academic_year,
    status: r.status,
    expectedMembership: r.expected_membership,
    preferredMeetingSchedule: r.preferred_meeting_schedule,
    meetingLocation: r.meeting_location,
    logoUrl: r.logo_url,
    bannerUrl: r.banner_url,
    rejectionReason: r.rejection_reason,
    createdAt: r.created_at,
    advisor: r.advisor_id
      ? {
          id: r.advisor_id,
          firstName: r.advisor_first_name,
          lastName: r.advisor_last_name,
          email: r.advisor_email,
          avatar: r.advisor_avatar,
        }
      : null,
    creator: {
      firstName: r.creator_first_name,
      lastName: r.creator_last_name,
    },
    memberCount: r.member_count,
    upcomingEventsCount: r.upcoming_events_count,
    leaders: leadersMap.get(r.id) || [],
    isAdvisor: r.advisor_id === userId,
    isLeader: (leadersMap.get(r.id) || []).some((l) => l.studentId === userId),
    isMember: r.my_membership_status === "ACTIVE",
    membershipStatus: r.my_membership_status || null,
  }));
}

export async function getClubOverview(schoolId: string, userId: string, userRole: string) {
  await ensureClubTables();

  const totalClubsRes: any[] = await db.$queryRawUnsafe(
    `SELECT COUNT(*)::int as count FROM clubs WHERE school_id = $1`,
    schoolId,
  );
  const activeClubsRes: any[] = await db.$queryRawUnsafe(
    `SELECT COUNT(*)::int as count FROM clubs WHERE school_id = $1 AND status = 'ACTIVE'`,
    schoolId,
  );
  const pendingClubsRes: any[] = await db.$queryRawUnsafe(
    `SELECT COUNT(*)::int as count FROM clubs WHERE school_id = $1 AND status = 'PENDING_APPROVAL'`,
    schoolId,
  );
  const renewalRequiredRes: any[] = await db.$queryRawUnsafe(
    `SELECT COUNT(*)::int as count FROM clubs WHERE school_id = $1 AND status = 'RENEWAL_REQUIRED'`,
    schoolId,
  );
  const suspendedClubsRes: any[] = await db.$queryRawUnsafe(
    `SELECT COUNT(*)::int as count FROM clubs WHERE school_id = $1 AND status = 'SUSPENDED'`,
    schoolId,
  );
  const totalMembersRes: any[] = await db.$queryRawUnsafe(
    `SELECT COUNT(*)::int as count FROM club_memberships WHERE school_id = $1 AND status = 'ACTIVE'`,
    schoolId,
  );
  const upcomingEventsRes: any[] = await db.$queryRawUnsafe(
    `SELECT COUNT(*)::int as count FROM club_events WHERE school_id = $1 AND status IN ('APPROVED', 'PUBLISHED') AND date >= CURRENT_DATE`,
    schoolId,
  );

  // Category breakdown
  const categoryStats: any[] = await db.$queryRawUnsafe(
    `
    SELECT category, COUNT(*)::int as count
    FROM clubs
    WHERE school_id = $1 AND status = 'ACTIVE'
    GROUP BY category
    ORDER BY count DESC
  `,
    schoolId,
  );

  return {
    totalClubs: totalClubsRes[0]?.count || 0,
    activeClubs: activeClubsRes[0]?.count || 0,
    pendingApproval: pendingClubsRes[0]?.count || 0,
    renewalRequired: renewalRequiredRes[0]?.count || 0,
    suspended: suspendedClubsRes[0]?.count || 0,
    totalMembers: totalMembersRes[0]?.count || 0,
    upcomingEvents: upcomingEventsRes[0]?.count || 0,
    categoryStats,
  };
}

export async function getMyClubs(schoolId: string, userId: string) {
  await ensureClubTables();

  const joinedClubs: any[] = await db.$queryRawUnsafe(
    `
    SELECT
      c.*,
      cm.role as member_role,
      cm.status as membership_status,
      cm.join_date,
      u."firstName" as advisor_first_name,
      u."lastName" as advisor_last_name,
      (SELECT COUNT(*)::int FROM club_memberships m WHERE m.club_id = c.id AND m.status = 'ACTIVE') as member_count
    FROM club_memberships cm
    JOIN clubs c ON cm.club_id = c.id
    LEFT JOIN users u ON c.advisor_id = u.id
    WHERE cm.school_id = $1 AND cm.student_id = $2 AND cm.status = 'ACTIVE'
    ORDER BY c.name ASC
  `,
    schoolId,
    userId,
  );

  const advisedClubs: any[] = await db.$queryRawUnsafe(
    `
    SELECT
      c.*,
      (SELECT COUNT(*)::int FROM club_memberships m WHERE m.club_id = c.id AND m.status = 'ACTIVE') as member_count,
      (SELECT COUNT(*)::int FROM club_memberships m WHERE m.club_id = c.id AND m.status = 'REQUESTED') as pending_requests_count
    FROM clubs c
    WHERE c.school_id = $1 AND c.advisor_id = $2
    ORDER BY c.name ASC
  `,
    schoolId,
    userId,
  );

  const ledClubs: any[] = await db.$queryRawUnsafe(
    `
    SELECT
      c.*,
      cl.role as leader_role,
      (SELECT COUNT(*)::int FROM club_memberships m WHERE m.club_id = c.id AND m.status = 'ACTIVE') as member_count,
      (SELECT COUNT(*)::int FROM club_memberships m WHERE m.club_id = c.id AND m.status = 'REQUESTED') as pending_requests_count
    FROM club_leaderships cl
    JOIN clubs c ON cl.club_id = c.id
    WHERE cl.school_id = $1 AND cl.student_id = $2 AND cl.status = 'ACTIVE'
    ORDER BY c.name ASC
  `,
    schoolId,
    userId,
  );

  return {
    joinedClubs,
    advisedClubs,
    ledClubs,
  };
}

export async function getClubById(schoolId: string, clubId: string, userId: string, userRole: string) {
  await ensureClubTables();

  const clubRows: any[] = await db.$queryRawUnsafe(
    `
    SELECT
      c.*,
      u."firstName" as advisor_first_name,
      u."lastName" as advisor_last_name,
      u."email" as advisor_email,
      u."avatar" as advisor_avatar,
      u."phone" as advisor_phone,
      cb."firstName" as creator_first_name,
      cb."lastName" as creator_last_name,
      (SELECT COUNT(*)::int FROM club_memberships cm WHERE cm.club_id = c.id AND cm.status = 'ACTIVE') as member_count,
      (SELECT status FROM club_memberships cm WHERE cm.club_id = c.id AND cm.student_id = $3 ORDER BY cm.created_at DESC LIMIT 1) as my_membership_status,
      (SELECT role FROM club_memberships cm WHERE cm.club_id = c.id AND cm.student_id = $3 AND cm.status = 'ACTIVE' LIMIT 1) as my_club_role
    FROM clubs c
    LEFT JOIN users u ON c.advisor_id = u.id
    LEFT JOIN users cb ON c.created_by_id = cb.id
    WHERE c.id = $1 AND c.school_id = $2
  `,
    clubId,
    schoolId,
    userId,
  );

  if (!clubRows.length) {
    throw new AppError("Club not found", 404);
  }

  const club = clubRows[0];

  // Active leaders
  const leaders: any[] = await db.$queryRawUnsafe(
    `
    SELECT
      cl.*,
      u."firstName" as first_name,
      u."lastName" as last_name,
      u."email" as email,
      u."avatar" as avatar,
      u."phone" as phone
    FROM club_leaderships cl
    JOIN users u ON cl.student_id = u.id
    WHERE cl.club_id = $1 AND cl.status = 'ACTIVE'
    ORDER BY cl.created_at ASC
  `,
    clubId,
  );

  // Active members
  const members: any[] = await db.$queryRawUnsafe(
    `
    SELECT
      cm.*,
      u."firstName" as first_name,
      u."lastName" as last_name,
      u."email" as email,
      u."avatar" as avatar,
      u."phone" as phone,
      sp."admissionNumber" as admissionnumber,
      c.name as class_name
    FROM club_memberships cm
    JOIN users u ON cm.student_id = u.id
    LEFT JOIN student_profiles sp ON sp."userId" = u.id
    LEFT JOIN classes c ON sp."classId" = c.id
    WHERE cm.club_id = $1 AND cm.status = 'ACTIVE'
    ORDER BY u."firstName" ASC, u."lastName" ASC
  `,
    clubId,
  );

  // Pending membership requests
  const pendingRequests: any[] = await db.$queryRawUnsafe(
    `
    SELECT
      cm.*,
      u."firstName" as first_name,
      u."lastName" as last_name,
      u."email" as email,
      u."avatar" as avatar,
      sp."admissionNumber" as admissionnumber,
      c.name as class_name
    FROM club_memberships cm
    JOIN users u ON cm.student_id = u.id
    LEFT JOIN student_profiles sp ON sp."userId" = u.id
    LEFT JOIN classes c ON sp."classId" = c.id
    WHERE cm.club_id = $1 AND cm.status = 'REQUESTED'
    ORDER BY cm.created_at ASC
  `,
    clubId,
  );

  // Upcoming meetings
  const meetings: any[] = await db.$queryRawUnsafe(
    `
    SELECT
      m.*,
      u."firstName" as organizer_first_name,
      u."lastName" as organizer_last_name,
      (SELECT COUNT(*)::int FROM club_attendance_records ar WHERE ar.meeting_id = m.id AND ar.status = 'PRESENT') as attended_count
    FROM club_meetings m
    LEFT JOIN users u ON m.organizer_id = u.id
    WHERE m.club_id = $1
    ORDER BY m.date DESC, m.start_time DESC
    LIMIT 20
  `,
    clubId,
  );

  // Club events
  const events: any[] = await db.$queryRawUnsafe(
    `
    SELECT
      e.*,
      u."firstName" as organizer_first_name,
      u."lastName" as organizer_last_name,
      (SELECT COUNT(*)::int FROM club_event_rsvps r WHERE r.event_id = e.id AND r.status = 'REGISTERED') as rsvp_count,
      (SELECT status FROM club_event_rsvps r WHERE r.event_id = e.id AND r.user_id = $2) as my_rsvp_status
    FROM club_events e
    LEFT JOIN users u ON e.organizer_id = u.id
    WHERE e.club_id = $1
    ORDER BY e.date DESC
    LIMIT 20
  `,
    clubId,
    userId,
  );

  // Announcements
  const announcements: any[] = await db.$queryRawUnsafe(
    `
    SELECT
      a.*,
      u."firstName" as author_first_name,
      u."lastName" as author_last_name,
      u."avatar" as author_avatar,
      u."role"::text as author_role
    FROM club_announcements a
    JOIN users u ON a.author_id = u.id
    WHERE a.club_id = $1
    ORDER BY a.is_pinned DESC, a.created_at DESC
    LIMIT 15
  `,
    clubId,
  );

  // Goals
  const goals: any[] = await db.$queryRawUnsafe(
    `
    SELECT * FROM club_goals
    WHERE club_id = $1 AND academic_year = $2
    ORDER BY created_at ASC
  `,
    clubId,
    club.academic_year,
  );

  // Documents
  const documents: any[] = await db.$queryRawUnsafe(
    `
    SELECT
      d.*,
      u."firstName" as uploader_first_name,
      u."lastName" as uploader_last_name
    FROM club_documents d
    JOIN users u ON d.uploaded_by_id = u.id
    WHERE d.club_id = $1
    ORDER BY d.created_at DESC
  `,
    clubId,
  );

  // Activities Portfolio
  const activities: any[] = await db.$queryRawUnsafe(
    `
    SELECT
      act.*,
      u."firstName" as creator_first_name,
      u."lastName" as creator_last_name
    FROM club_activities act
    JOIN users u ON act.created_by_id = u.id
    WHERE act.club_id = $1
    ORDER BY act.date DESC
  `,
    clubId,
  );

  const isAdvisor = club.advisor_id === userId;
  const isLeader = leaders.some((l) => l.student_id === userId);
  const isMember = club.my_membership_status === "ACTIVE";
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);

  const canManageClub = isAdmin || isAdvisor || isLeader;

  return {
    ...club,
    advisor: club.advisor_id
      ? {
          id: club.advisor_id,
          firstName: club.advisor_first_name,
          lastName: club.advisor_last_name,
          email: club.advisor_email,
          avatar: club.advisor_avatar,
          phone: club.advisor_phone,
        }
      : null,
    creator: {
      firstName: club.creator_first_name,
      lastName: club.creator_last_name,
    },
    leaders: leaders.map((l) => ({
      id: l.id,
      studentId: l.student_id,
      role: l.role,
      academicYear: l.academic_year,
      startDate: l.start_date,
      student: {
        firstName: l.first_name,
        lastName: l.last_name,
        email: l.email,
        avatar: l.avatar,
        phone: l.phone,
      },
    })),
    members: members.map((m) => ({
      id: m.id,
      studentId: m.student_id,
      status: m.status,
      role: m.role,
      joinDate: m.join_date,
      admissionNumber: m.admissionnumber,
      className: m.class_name,
      student: {
        firstName: m.first_name,
        lastName: m.last_name,
        email: m.email,
        avatar: m.avatar,
        phone: m.phone,
      },
    })),
    pendingRequests: canManageClub
      ? pendingRequests.map((p) => ({
          id: p.id,
          studentId: p.student_id,
          requestNotes: p.request_notes,
          createdAt: p.created_at,
          admissionNumber: p.admissionnumber,
          className: p.class_name,
          student: {
            firstName: p.first_name,
            lastName: p.last_name,
            email: p.email,
            avatar: p.avatar,
          },
        }))
      : [],
    meetings,
    events,
    announcements,
    goals,
    documents,
    activities,
    permissions: {
      canManageClub,
      isAdmin,
      isAdvisor,
      isLeader,
      isMember,
      canPostAnnouncement: canManageClub,
      canScheduleMeeting: canManageClub,
      canCreateEvent: canManageClub,
      canManageMembers: canManageClub,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CREATE / PROPOSE CLUB & ADMIN WORKFLOW
// ─────────────────────────────────────────────────────────────────────────────

export async function createClubProposal(
  schoolId: string,
  userId: string,
  userRole: string,
  data: {
    name: string;
    description: string;
    purpose: string;
    category: ClubCategory;
    academicYear: string;
    advisorId?: string | null;
    expectedMembership?: number;
    preferredMeetingSchedule?: string;
    meetingLocation?: string;
    logoUrl?: string | null;
    bannerUrl?: string | null;
    initialLeaderId?: string | null;
  },
) {
  await ensureClubTables();

  const {
    name,
    description,
    purpose,
    category,
    academicYear,
    advisorId = null,
    expectedMembership = 20,
    preferredMeetingSchedule = "Weekly",
    meetingLocation = "Campus Hall",
    logoUrl = null,
    bannerUrl = null,
    initialLeaderId = null,
  } = data;

  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);
  const initialStatus: ClubStatus = isAdmin ? "ACTIVE" : "PENDING_APPROVAL";

  const rows: any[] = await db.$queryRawUnsafe(
    `
    INSERT INTO clubs (
      school_id, name, description, purpose, category, academic_year,
      status, advisor_id, created_by_id, expected_membership,
      preferred_meeting_schedule, meeting_location, logo_url, banner_url,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
    RETURNING *;
  `,
    schoolId,
    name,
    description,
    purpose,
    category,
    academicYear,
    initialStatus,
    advisorId,
    userId,
    expectedMembership,
    preferredMeetingSchedule,
    meetingLocation,
    logoUrl,
    bannerUrl,
  );

  const club = rows[0];

  // If creator is student, make them President leader
  const leaderStudentId = initialLeaderId || (userRole === "STUDENT" ? userId : null);
  if (leaderStudentId) {
    await db.$executeRawUnsafe(
      `
      INSERT INTO club_leaderships (school_id, club_id, student_id, role, academic_year, start_date, status, assigned_by_id)
      VALUES ($1, $2, $3, 'PRESIDENT', $4, NOW(), 'ACTIVE', $5)
    `,
      schoolId,
      club.id,
      leaderStudentId,
      academicYear,
      userId,
    );

    // Also auto-add as active member
    await db.$executeRawUnsafe(
      `
      INSERT INTO club_memberships (school_id, club_id, student_id, status, role, academic_year, join_date)
      VALUES ($1, $2, $3, 'ACTIVE', 'PRESIDENT', $4, NOW())
      ON CONFLICT (club_id, student_id, academic_year) DO UPDATE SET status = 'ACTIVE', role = 'PRESIDENT'
    `,
      schoolId,
      club.id,
      leaderStudentId,
      academicYear,
    );
  }

  // If advisor assigned, notify advisor
  if (advisorId) {
    await db.notification.create({
      data: {
        schoolId,
        userId: advisorId,
        type: NotificationType.GENERAL,
        title: `🏛️ New Club Advisor Nomination: ${name}`,
        body: `You have been nominated as faculty advisor for the newly proposed "${name}" club.`,
        data: { clubId: club.id, link: `/clubs/${club.id}` },
      },
    });
    safeEmitToUser(advisorId, "notification:new", {
      title: `🏛️ New Club Advisor Nomination: ${name}`,
      body: `You have been nominated as faculty advisor for the "${name}" club.`,
      link: `/clubs/${club.id}`,
    });
  }

  return club;
}

export async function updateClub(
  schoolId: string,
  clubId: string,
  data: {
    name?: string;
    description?: string;
    purpose?: string;
    category?: ClubCategory;
    advisorId?: string | null;
    expectedMembership?: number;
    preferredMeetingSchedule?: string;
    meetingLocation?: string;
    logoUrl?: string | null;
    bannerUrl?: string | null;
  },
) {
  await ensureClubTables();

  const updates: string[] = [];
  const params: any[] = [clubId, schoolId];

  if (data.name) {
    params.push(data.name);
    updates.push(`name = $${params.length}`);
  }
  if (data.description !== undefined) {
    params.push(data.description);
    updates.push(`description = $${params.length}`);
  }
  if (data.purpose !== undefined) {
    params.push(data.purpose);
    updates.push(`purpose = $${params.length}`);
  }
  if (data.category) {
    params.push(data.category);
    updates.push(`category = $${params.length}`);
  }
  if (data.advisorId !== undefined) {
    params.push(data.advisorId || null);
    updates.push(`advisor_id = $${params.length}`);
  }
  if (data.expectedMembership !== undefined) {
    params.push(data.expectedMembership);
    updates.push(`expected_membership = $${params.length}`);
  }
  if (data.preferredMeetingSchedule !== undefined) {
    params.push(data.preferredMeetingSchedule);
    updates.push(`preferred_meeting_schedule = $${params.length}`);
  }
  if (data.meetingLocation !== undefined) {
    params.push(data.meetingLocation);
    updates.push(`meeting_location = $${params.length}`);
  }
  if (data.logoUrl !== undefined) {
    params.push(data.logoUrl);
    updates.push(`logo_url = $${params.length}`);
  }
  if (data.bannerUrl !== undefined) {
    params.push(data.bannerUrl);
    updates.push(`banner_url = $${params.length}`);
  }

  updates.push(`updated_at = NOW()`);

  const rows: any[] = await db.$queryRawUnsafe(
    `
    UPDATE clubs
    SET ${updates.join(", ")}
    WHERE id = $1 AND school_id = $2
    RETURNING *;
  `,
    ...params,
  );

  return rows[0];
}

export async function updateClubStatus(
  schoolId: string,
  clubId: string,
  status: ClubStatus,
  reason?: string,
) {
  await ensureClubTables();

  const rows: any[] = await db.$queryRawUnsafe(
    `
    UPDATE clubs
    SET status = $1, rejection_reason = $2, updated_at = NOW()
    WHERE id = $3 AND school_id = $4
    RETURNING *;
  `,
    status,
    reason || null,
    clubId,
    schoolId,
  );

  if (!rows.length) throw new AppError("Club not found", 404);
  const club = rows[0];

  // Notify creator & leaders
  const leaders: any[] = await db.$queryRawUnsafe(
    `SELECT student_id FROM club_leaderships WHERE club_id = $1 AND status = 'ACTIVE'`,
    clubId,
  );

  const notifyUserIds = new Set<string>([club.created_by_id, ...(leaders.map((l) => l.student_id))]);
  if (club.advisor_id) notifyUserIds.add(club.advisor_id);

  for (const uid of notifyUserIds) {
    const statusMsg =
      status === "ACTIVE"
        ? `🎉 Great news! "${club.name}" club has been approved and is now active.`
        : status === "REJECTED"
        ? `"${club.name}" proposal was not approved: ${reason || "No details provided."}`
        : `"${club.name}" club status has been updated to ${status}.`;

    await db.notification.create({
      data: {
        schoolId,
        userId: uid,
        type: NotificationType.GENERAL,
        title: `Club Status Update: ${club.name}`,
        body: statusMsg,
        data: { clubId: club.id, status, link: `/clubs/${club.id}` },
      },
    });
    safeEmitToUser(uid, "notification:new", {
      title: `Club Status: ${club.name}`,
      body: statusMsg,
      link: `/clubs/${club.id}`,
    });
  }

  return club;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. MEMBERSHIPS & LEADERSHIP
// ─────────────────────────────────────────────────────────────────────────────

export async function requestClubMembership(
  schoolId: string,
  clubId: string,
  studentId: string,
  requestNotes?: string,
) {
  await ensureClubTables();

  const clubRows: any[] = await db.$queryRawUnsafe(
    `SELECT * FROM clubs WHERE id = $1 AND school_id = $2`,
    clubId,
    schoolId,
  );
  if (!clubRows.length) throw new AppError("Club not found", 404);
  const club = clubRows[0];
  if (club.status !== "ACTIVE") {
    throw new AppError("Only active clubs can accept membership requests", 400);
  }

  const rows: any[] = await db.$queryRawUnsafe(
    `
    INSERT INTO club_memberships (
      school_id, club_id, student_id, status, role, request_notes, academic_year, join_date
    ) VALUES ($1, $2, $3, 'REQUESTED', 'MEMBER', $4, $5, NOW())
    ON CONFLICT (club_id, student_id, academic_year) DO UPDATE SET
      status = 'REQUESTED',
      request_notes = EXCLUDED.request_notes,
      updated_at = NOW()
    RETURNING *;
  `,
    schoolId,
    clubId,
    studentId,
    requestNotes || null,
    club.academic_year,
  );

  // Notify advisor & leaders
  const leaders: any[] = await db.$queryRawUnsafe(
    `SELECT student_id FROM club_leaderships WHERE club_id = $1 AND status = 'ACTIVE'`,
    clubId,
  );

  const studentUser = await db.user.findUnique({
    where: { id: studentId },
    select: { firstName: true, lastName: true },
  });

  const notifyUids = new Set<string>(leaders.map((l) => l.student_id));
  if (club.advisor_id) notifyUids.add(club.advisor_id);

  for (const uid of notifyUids) {
    safeEmitToUser(uid, "notification:new", {
      title: `📩 New Membership Request: ${club.name}`,
      body: `${studentUser?.firstName} ${studentUser?.lastName} requested to join ${club.name}.`,
      link: `/clubs/${clubId}`,
    });
  }

  return rows[0];
}

export async function updateMembershipStatus(
  schoolId: string,
  clubId: string,
  membershipId: string,
  status: MembershipStatus,
) {
  await ensureClubTables();

  const rows: any[] = await db.$queryRawUnsafe(
    `
    UPDATE club_memberships
    SET status = $1, updated_at = NOW(), end_date = CASE WHEN $1 IN ('LEFT', 'REMOVED', 'REJECTED') THEN NOW() ELSE end_date END
    WHERE id = $2 AND club_id = $3 AND school_id = $4
    RETURNING *;
  `,
    status,
    membershipId,
    clubId,
    schoolId,
  );

  if (!rows.length) throw new AppError("Membership record not found", 404);
  const mem = rows[0];

  const clubRows: any[] = await db.$queryRawUnsafe(`SELECT name FROM clubs WHERE id = $1`, clubId);
  const clubName = clubRows[0]?.name || "Club";

  // Notify student
  const msg =
    status === "ACTIVE"
      ? `🎉 Congratulations! Your request to join "${clubName}" has been approved!`
      : status === "REJECTED"
      ? `Your membership request for "${clubName}" was declined.`
      : `Your membership status for "${clubName}" is now ${status}.`;

  await db.notification.create({
    data: {
      schoolId,
      userId: mem.student_id,
      type: NotificationType.GENERAL,
      title: `Club Membership: ${clubName}`,
      body: msg,
      data: { clubId, status, link: `/clubs/${clubId}` },
    },
  });

  emitToUser(mem.student_id, "notification:new", {
    title: `Club Membership: ${clubName}`,
    body: msg,
    link: `/clubs/${clubId}`,
  });

  return mem;
}

export async function assignStudentLeadership(
  schoolId: string,
  clubId: string,
  assignedById: string,
  data: {
    studentId: string;
    role: LeadershipRole;
    academicYear: string;
  },
) {
  await ensureClubTables();

  const { studentId, role, academicYear } = data;

  // End existing leader with the exact same role in this academic year
  await db.$executeRawUnsafe(
    `
    UPDATE club_leaderships
    SET status = 'ENDED', end_date = NOW()
    WHERE club_id = $1 AND role = $2 AND academic_year = $3 AND status = 'ACTIVE'
  `,
    clubId,
    role,
    academicYear,
  );

  // Insert new historical leadership assignment
  const rows: any[] = await db.$queryRawUnsafe(
    `
    INSERT INTO club_leaderships (
      school_id, club_id, student_id, role, academic_year, start_date, status, assigned_by_id
    ) VALUES ($1, $2, $3, $4, $5, NOW(), 'ACTIVE', $6)
    RETURNING *;
  `,
    schoolId,
    clubId,
    studentId,
    role,
    academicYear,
    assignedById,
  );

  // Ensure student is also marked active member with leadership role
  await db.$executeRawUnsafe(
    `
    INSERT INTO club_memberships (school_id, club_id, student_id, status, role, academic_year, join_date)
    VALUES ($1, $2, $3, 'ACTIVE', $4, $5, NOW())
    ON CONFLICT (club_id, student_id, academic_year) DO UPDATE SET status = 'ACTIVE', role = $4
  `,
    schoolId,
    clubId,
    studentId,
    role,
    academicYear,
  );

  // Notify student
  const clubRows: any[] = await db.$queryRawUnsafe(`SELECT name FROM clubs WHERE id = $1`, clubId);
  const clubName = clubRows[0]?.name || "Club";

  await db.notification.create({
    data: {
      schoolId,
      userId: studentId,
      type: NotificationType.GENERAL,
      title: `🎖️ Club Leadership Appointment: ${role}`,
      body: `You have been appointed as ${role} for "${clubName}" for academic year ${academicYear}.`,
      data: { clubId, role, link: `/clubs/${clubId}` },
    },
  });

  emitToUser(studentId, "notification:new", {
    title: `🎖️ Club Leadership: ${role}`,
    body: `You have been appointed as ${role} for "${clubName}".`,
    link: `/clubs/${clubId}`,
  });

  return rows[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. MEETINGS, CONFLICT DETECTION & ATTENDANCE
// ─────────────────────────────────────────────────────────────────────────────

export async function scheduleClubMeeting(
  schoolId: string,
  clubId: string,
  organizerId: string,
  data: {
    title: string;
    description?: string;
    date: string; // YYYY-MM-DD
    startTime: string; // HH:mm
    endTime: string; // HH:mm
    location: string;
    recurrence?: string;
  },
) {
  await ensureClubTables();

  const {
    title,
    description = null,
    date,
    startTime,
    endTime,
    location,
    recurrence = "NONE",
  } = data;

  // Conflict detection: Check if location is already booked by another meeting or event
  const conflictMeetings: any[] = await db.$queryRawUnsafe(
    `
    SELECT m.title, c.name as club_name, m.start_time, m.end_time
    FROM club_meetings m
    JOIN clubs c ON m.club_id = c.id
    WHERE m.school_id = $1 AND m.date = $2::date AND LOWER(m.location) = LOWER($3)
      AND m.status = 'SCHEDULED'
      AND ((m.start_time <= $4 AND m.end_time > $4) OR (m.start_time < $5 AND m.end_time >= $5) OR (m.start_time >= $4 AND m.end_time <= $5))
  `,
    schoolId,
    date,
    location,
    startTime,
    endTime,
  );

  if (conflictMeetings.length > 0) {
    const c = conflictMeetings[0];
    throw new AppError(
      `Room/Location conflict: "${location}" is already booked on ${date} (${c.start_time} - ${c.end_time}) for "${c.title}" (${c.club_name}). Please choose another location or time.`,
      409,
    );
  }

  const rows: any[] = await db.$queryRawUnsafe(
    `
    INSERT INTO club_meetings (
      school_id, club_id, title, description, date, start_time, end_time, location, recurrence, status, organizer_id
    ) VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, 'SCHEDULED', $10)
    RETURNING *;
  `,
    schoolId,
    clubId,
    title,
    description,
    date,
    startTime,
    endTime,
    location,
    recurrence,
    organizerId,
  );

  const meeting = rows[0];

  // Notify all active club members
  const members: any[] = await db.$queryRawUnsafe(
    `SELECT student_id FROM club_memberships WHERE club_id = $1 AND status = 'ACTIVE'`,
    clubId,
  );

  const clubRows: any[] = await db.$queryRawUnsafe(`SELECT name FROM clubs WHERE id = $1`, clubId);
  const clubName = clubRows[0]?.name || "Club";

  for (const m of members) {
    safeEmitToUser(m.student_id, "notification:new", {
      title: `📅 ${clubName}: Meeting Scheduled`,
      body: `"${title}" on ${date} at ${startTime} in ${location}.`,
      link: `/clubs/${clubId}`,
    });
  }

  return meeting;
}

export async function recordClubMeetingAttendance(
  schoolId: string,
  clubId: string,
  meetingId: string,
  markedById: string,
  records: Array<{
    studentId: string;
    status: "PRESENT" | "ABSENT" | "EXCUSED";
    notes?: string;
  }>,
) {
  await ensureClubTables();

  const meetingRows: any[] = await db.$queryRawUnsafe(
    `SELECT date FROM club_meetings WHERE id = $1 AND club_id = $2`,
    meetingId,
    clubId,
  );
  if (!meetingRows.length) throw new AppError("Meeting not found", 404);
  const meetingDate = meetingRows[0].date;

  const results = [];
  for (const r of records) {
    const res: any[] = await db.$queryRawUnsafe(
      `
      INSERT INTO club_attendance_records (
        school_id, club_id, meeting_id, student_id, date, status, marked_by_id, notes
      ) VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8)
      ON CONFLICT (club_id, meeting_id, student_id) DO UPDATE SET
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        marked_by_id = EXCLUDED.marked_by_id
      RETURNING *;
    `,
      schoolId,
      clubId,
      meetingId,
      r.studentId,
      meetingDate,
      r.status,
      markedById,
      r.notes || null,
    );
    results.push(res[0]);
  }

  // Update meeting status to COMPLETED
  await db.$executeRawUnsafe(
    `UPDATE club_meetings SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
    meetingId,
  );

  return results;
}

export async function getClubMeetingAttendance(clubId: string, meetingId: string) {
  await ensureClubTables();

  const members: any[] = await db.$queryRawUnsafe(
    `
    SELECT
      cm.student_id,
      cm.role as member_role,
      u."firstName" as first_name,
      u."lastName" as last_name,
      u."email" as email,
      u."avatar" as avatar,
      ar.id as attendance_id,
      COALESCE(ar.status, 'UNRECORDED') as attendance_status,
      ar.notes as attendance_notes
    FROM club_memberships cm
    JOIN users u ON cm.student_id = u.id
    LEFT JOIN club_attendance_records ar ON ar.meeting_id = $2 AND ar.student_id = cm.student_id
    WHERE cm.club_id = $1 AND cm.status = 'ACTIVE'
    ORDER BY u."firstName" ASC, u."lastName" ASC
  `,
    clubId,
    meetingId,
  );

  return members.map((m) => ({
    studentId: m.student_id,
    memberRole: m.member_role,
    status: m.attendance_status,
    notes: m.attendance_notes,
    student: {
      firstName: m.first_name,
      lastName: m.last_name,
      email: m.email,
      avatar: m.avatar,
    },
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. EVENTS, RSVPS & CALENDAR
// ─────────────────────────────────────────────────────────────────────────────

export async function createClubEvent(
  schoolId: string,
  clubId: string,
  organizerId: string,
  userRole: string,
  data: {
    title: string;
    description?: string;
    eventType: string;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    capacity?: number;
    audience?: string;
    attachmentUrl?: string | null;
  },
) {
  await ensureClubTables();

  const {
    title,
    description = null,
    eventType = "WORKSHOP",
    date,
    startTime,
    endTime,
    location,
    capacity = 0,
    audience = "CLUB_MEMBERS",
    attachmentUrl = null,
  } = data;

  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);
  // Auto-approve if created by admin or whole school event requires approval
  const initialStatus: EventStatus = isAdmin ? "APPROVED" : "SUBMITTED";

  const rows: any[] = await db.$queryRawUnsafe(
    `
    INSERT INTO club_events (
      school_id, club_id, title, description, event_type, date, start_time, end_time, location, capacity, audience, status, organizer_id, attachment_url
    ) VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *;
  `,
    schoolId,
    clubId,
    title,
    description,
    eventType,
    date,
    startTime,
    endTime,
    location,
    capacity,
    audience,
    initialStatus,
    organizerId,
    attachmentUrl,
  );

  const event = rows[0];

  // Notify advisor & admin if proposal submitted
  const clubRows: any[] = await db.$queryRawUnsafe(
    `SELECT name, advisor_id FROM clubs WHERE id = $1`,
    clubId,
  );
  const club = clubRows[0];

  if (club?.advisor_id && !isAdmin) {
    await db.notification.create({
      data: {
        schoolId,
        userId: club.advisor_id,
        type: NotificationType.GENERAL,
        title: `🏆 Event Proposal: ${club.name}`,
        body: `A new event "${title}" was proposed for ${date} and awaits your review.`,
        data: { clubId, eventId: event.id, link: `/clubs/${clubId}` },
      },
    });
    safeEmitToUser(club.advisor_id, "notification:new", {
      title: `🏆 Event Proposal: ${club.name}`,
      body: `"${title}" event proposal submitted for ${date}.`,
      link: `/clubs/${clubId}`,
    });
  }

  return event;
}

export async function updateClubEventStatus(
  schoolId: string,
  clubId: string,
  eventId: string,
  status: EventStatus,
) {
  await ensureClubTables();

  const rows: any[] = await db.$queryRawUnsafe(
    `
    UPDATE club_events
    SET status = $1, updated_at = NOW()
    WHERE id = $2 AND club_id = $3 AND school_id = $4
    RETURNING *;
  `,
    status,
    eventId,
    clubId,
    schoolId,
  );

  if (!rows.length) throw new AppError("Event not found", 404);
  const event = rows[0];

  // If approved/published, notify club members
  if (["APPROVED", "PUBLISHED"].includes(status)) {
    const clubRows: any[] = await db.$queryRawUnsafe(`SELECT name FROM clubs WHERE id = $1`, clubId);
    const clubName = clubRows[0]?.name || "Club";

    const members: any[] = await db.$queryRawUnsafe(
      `SELECT student_id FROM club_memberships WHERE club_id = $1 AND status = 'ACTIVE'`,
      clubId,
    );

    for (const m of members) {
      safeEmitToUser(m.student_id, "notification:new", {
        title: `🎉 ${clubName}: Event Published`,
        body: `"${event.title}" is scheduled for ${event.date} at ${event.location}. RSVP now!`,
        link: `/clubs/${clubId}`,
      });
    }
  }

  return event;
}

export async function rsvpClubEvent(
  eventId: string,
  userId: string,
  status: "REGISTERED" | "CANCELLED",
  notes?: string,
) {
  await ensureClubTables();

  const eventRows: any[] = await db.$queryRawUnsafe(
    `
    SELECT e.*, (SELECT COUNT(*)::int FROM club_event_rsvps r WHERE r.event_id = e.id AND r.status = 'REGISTERED') as current_rsvps
    FROM club_events e WHERE e.id = $1
  `,
    eventId,
  );

  if (!eventRows.length) throw new AppError("Event not found", 404);
  const event = eventRows[0];

  let rsvpStatus = status;
  if (status === "REGISTERED" && event.capacity > 0 && event.current_rsvps >= event.capacity) {
    rsvpStatus = "WAITLIST" as any;
  }

  const rows: any[] = await db.$queryRawUnsafe(
    `
    INSERT INTO club_event_rsvps (event_id, user_id, status, notes, created_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (event_id, user_id) DO UPDATE SET
      status = EXCLUDED.status,
      notes = EXCLUDED.notes
    RETURNING *;
  `,
    eventId,
    userId,
    rsvpStatus,
    notes || null,
  );

  return rows[0];
}

export async function getUpcomingClubEvents(schoolId: string) {
  await ensureClubTables();

  const events: any[] = await db.$queryRawUnsafe(
    `
    SELECT
      e.id,
      e.club_id as "clubId",
      e.title,
      e.description,
      e.event_type as "eventType",
      e.date,
      e.start_time as "startTime",
      e.end_time as "endTime",
      e.location,
      e.status,
      e.capacity,
      e.audience,
      json_build_object('id', c.id, 'name', c.name, 'category', c.category) as club
    FROM club_events e
    JOIN clubs c ON e.club_id = c.id
    WHERE e.school_id = $1 AND e.date >= CURRENT_DATE AND e.status IN ('APPROVED', 'PUBLISHED')
    ORDER BY e.date ASC, e.start_time ASC
  `,
    schoolId,
  );

  const meetings: any[] = await db.$queryRawUnsafe(
    `
    SELECT
      m.id,
      m.club_id as "clubId",
      m.title,
      m.description,
      m.date,
      m.start_time as "startTime",
      m.end_time as "endTime",
      m.location,
      m.status,
      json_build_object('id', c.id, 'name', c.name, 'category', c.category) as club
    FROM club_meetings m
    JOIN clubs c ON m.club_id = c.id
    WHERE m.school_id = $1 AND m.date >= CURRENT_DATE AND m.status = 'SCHEDULED'
    ORDER BY m.date ASC, m.start_time ASC
  `,
    schoolId,
  );

  return { events, meetings };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. ACTIVITIES, ANNOUNCEMENTS, DOCUMENTS & GOALS
// ─────────────────────────────────────────────────────────────────────────────

export async function recordClubActivity(
  schoolId: string,
  clubId: string,
  createdById: string,
  data: {
    title: string;
    description?: string;
    date: string;
    outcome?: string;
    participantsCount?: number;
    attachmentUrl?: string | null;
    mediaUrls?: string[];
    eventId?: string | null;
  },
) {
  await ensureClubTables();

  const {
    title,
    description = null,
    date,
    outcome = null,
    participantsCount = 0,
    attachmentUrl = null,
    mediaUrls = [],
    eventId = null,
  } = data;

  const rows: any[] = await db.$queryRawUnsafe(
    `
    INSERT INTO club_activities (
      school_id, club_id, event_id, title, description, date, outcome, participants_count, attachment_url, media_urls, created_by_id, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10::jsonb, $11, NOW())
    RETURNING *;
  `,
    schoolId,
    clubId,
    eventId,
    title,
    description,
    date,
    outcome,
    participantsCount,
    attachmentUrl,
    JSON.stringify(mediaUrls),
    createdById,
  );

  return rows[0];
}

export async function createClubAnnouncement(
  schoolId: string,
  clubId: string,
  authorId: string,
  data: {
    title: string;
    content: string;
    priority?: "NORMAL" | "URGENT";
    isPinned?: boolean;
  },
) {
  await ensureClubTables();

  const { title, content, priority = "NORMAL", isPinned = false } = data;

  const rows: any[] = await db.$queryRawUnsafe(
    `
    INSERT INTO club_announcements (
      school_id, club_id, title, content, priority, is_pinned, author_id, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    RETURNING *;
  `,
    schoolId,
    clubId,
    title,
    content,
    priority,
    isPinned,
    authorId,
  );

  const announcement = rows[0];

  // Notify all club members & advisor
  const clubRows: any[] = await db.$queryRawUnsafe(`SELECT name, advisor_id FROM clubs WHERE id = $1`, clubId);
  const club = clubRows[0];
  const clubName = club?.name || "Club";

  const members: any[] = await db.$queryRawUnsafe(
    `SELECT student_id FROM club_memberships WHERE club_id = $1 AND status = 'ACTIVE'`,
    clubId,
  );

  const notifyUids = new Set<string>(members.map((m) => m.student_id));
  if (club?.advisor_id) notifyUids.add(club.advisor_id);
  notifyUids.delete(authorId);

  for (const uid of notifyUids) {
    await db.notification.create({
      data: {
        schoolId,
        userId: uid,
        type: NotificationType.ANNOUNCEMENT,
        title: `📢 ${clubName}: ${title}`,
        body: content.slice(0, 150),
        data: { clubId, announcementId: announcement.id, link: `/clubs/${clubId}` },
      },
    });

    safeEmitToUser(uid, "notification:new", {
      title: `📢 ${clubName}: ${title}`,
      body: content,
      link: `/clubs/${clubId}`,
    });
  }

  return announcement;
}

export async function addClubDocument(
  schoolId: string,
  clubId: string,
  uploadedById: string,
  data: {
    name: string;
    category?: string;
    fileUrl: string;
    fileSize?: number;
    mimeType?: string;
  },
) {
  await ensureClubTables();

  const { name, category = "OTHER", fileUrl, fileSize = 0, mimeType = "application/pdf" } = data;

  const rows: any[] = await db.$queryRawUnsafe(
    `
    INSERT INTO club_documents (
      school_id, club_id, name, category, file_url, file_size, mime_type, uploaded_by_id, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    RETURNING *;
  `,
    schoolId,
    clubId,
    name,
    category,
    fileUrl,
    fileSize,
    mimeType,
    uploadedById,
  );

  return rows[0];
}

export async function deleteClubDocument(schoolId: string, clubId: string, docId: string) {
  await ensureClubTables();

  const count = await db.$executeRawUnsafe(
    `DELETE FROM club_documents WHERE id = $1 AND club_id = $2 AND school_id = $3`,
    docId,
    clubId,
    schoolId,
  );
  if (!count) throw new AppError("Document not found", 404);
  return { success: true };
}

export async function createClubGoal(
  schoolId: string,
  clubId: string,
  data: {
    title: string;
    description?: string;
    targetCount: number;
    currentCount?: number;
    unit?: string;
    academicYear: string;
  },
) {
  await ensureClubTables();

  const {
    title,
    description = null,
    targetCount,
    currentCount = 0,
    unit = "milestones",
    academicYear,
  } = data;

  const rows: any[] = await db.$queryRawUnsafe(
    `
    INSERT INTO club_goals (
      school_id, club_id, title, description, target_count, current_count, unit, status, academic_year, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'IN_PROGRESS', $8, NOW(), NOW())
    RETURNING *;
  `,
    schoolId,
    clubId,
    title,
    description,
    targetCount,
    currentCount,
    unit,
    academicYear,
  );

  return rows[0];
}

export async function updateClubGoalProgress(
  schoolId: string,
  clubId: string,
  goalId: string,
  data: { currentCount?: number; status?: "IN_PROGRESS" | "ACHIEVED" | "MISSED" },
) {
  await ensureClubTables();

  const updates: string[] = [];
  const params: any[] = [goalId, clubId, schoolId];

  if (data.currentCount !== undefined) {
    params.push(data.currentCount);
    updates.push(`current_count = $${params.length}`);
  }
  if (data.status) {
    params.push(data.status);
    updates.push(`status = $${params.length}`);
  }
  updates.push(`updated_at = NOW()`);

  const rows: any[] = await db.$queryRawUnsafe(
    `
    UPDATE club_goals
    SET ${updates.join(", ")}
    WHERE id = $1 AND club_id = $2 AND school_id = $3
    RETURNING *;
  `,
    ...params,
  );

  return rows[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. ACADEMIC-YEAR RENEWAL WORKFLOW
// ─────────────────────────────────────────────────────────────────────────────

export async function renewClubForNewYear(
  schoolId: string,
  clubId: string,
  userId: string,
  data: {
    newAcademicYear: string;
    newAdvisorId?: string | null;
    newPresidentId?: string | null;
    updatedPurpose?: string | null;
    meetingSchedule?: string | null;
  },
) {
  await ensureClubTables();

  const {
    newAcademicYear,
    newAdvisorId = null,
    newPresidentId = null,
    updatedPurpose = null,
    meetingSchedule = null,
  } = data;

  const clubRows: any[] = await db.$queryRawUnsafe(
    `SELECT * FROM clubs WHERE id = $1 AND school_id = $2`,
    clubId,
    schoolId,
  );
  if (!clubRows.length) throw new AppError("Club not found", 404);
  const club = clubRows[0];

  // Update club to new academic year with ACTIVE status
  const rows: any[] = await db.$queryRawUnsafe(
    `
    UPDATE clubs
    SET
      academic_year = $1,
      advisor_id = COALESCE($2, advisor_id),
      purpose = COALESCE($3, purpose),
      preferred_meeting_schedule = COALESCE($4, preferred_meeting_schedule),
      status = 'ACTIVE',
      updated_at = NOW()
    WHERE id = $5 AND school_id = $6
    RETURNING *;
  `,
    newAcademicYear,
    newAdvisorId,
    updatedPurpose,
    meetingSchedule,
    clubId,
    schoolId,
  );

  // If new president assigned
  if (newPresidentId) {
    await assignStudentLeadership(schoolId, clubId, userId, {
      studentId: newPresidentId,
      role: "PRESIDENT",
      academicYear: newAcademicYear,
    });
  }

  return rows[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. CANDIDATE LOOKUPS & DIRECT MEMBER REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────

export async function getFacultyCandidates(schoolId: string) {
  const teachers = await db.user.findMany({
    where: {
      schoolId,
      role: { in: [Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN] },
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      avatar: true,
      phone: true,
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  return teachers;
}

export async function getStudentCandidates(schoolId: string, search?: string) {
  const students = await db.user.findMany({
    where: {
      schoolId,
      role: Role.STUDENT,
      isActive: true,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              {
                studentProfile: {
                  admissionNumber: { contains: search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatar: true,
      studentProfile: {
        select: {
          admissionNumber: true,
          class: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 50,
  });

  return students.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    email: s.email,
    avatar: s.avatar,
    admissionNumber: s.studentProfile?.admissionNumber || "",
    className: s.studentProfile?.class?.name || "",
  }));
}

export async function registerClubMemberDirectly(
  schoolId: string,
  clubId: string,
  registeredById: string,
  data: {
    studentId: string;
    role?: LeadershipRole | "MEMBER";
    academicYear?: string;
  },
) {
  await ensureClubTables();

  const { studentId, role = "MEMBER", academicYear } = data;

  const clubRows: any[] = await db.$queryRawUnsafe(
    `SELECT * FROM clubs WHERE id = $1 AND school_id = $2`,
    clubId,
    schoolId,
  );
  if (!clubRows.length) throw new AppError("Club not found", 404);
  const club = clubRows[0];

  const year = academicYear || club.academic_year;

  // Insert or update membership to ACTIVE
  const rows: any[] = await db.$queryRawUnsafe(
    `
    INSERT INTO club_memberships (
      school_id, club_id, student_id, status, role, academic_year, join_date
    ) VALUES ($1, $2, $3, 'ACTIVE', $4, $5, NOW())
    ON CONFLICT (club_id, student_id, academic_year) DO UPDATE SET
      status = 'ACTIVE',
      role = EXCLUDED.role,
      updated_at = NOW()
    RETURNING *;
  `,
    schoolId,
    clubId,
    studentId,
    role,
    year,
  );

  // If role is a leadership role, also add to leadership tracking
  if (role !== "MEMBER") {
    await assignStudentLeadership(schoolId, clubId, registeredById, {
      studentId,
      role: role as LeadershipRole,
      academicYear: year,
    });
  }

  // Notify student
  await db.notification.create({
    data: {
      schoolId,
      userId: studentId,
      type: NotificationType.GENERAL,
      title: `🏛️ Registered to Club: ${club.name}`,
      body: `You have been registered as an active ${role.toLowerCase()} of "${club.name}".`,
      data: { clubId, role, link: `/clubs/${clubId}` },
    },
  });

  safeEmitToUser(studentId, "notification:new", {
    title: `🏛️ Registered to Club: ${club.name}`,
    body: `You have been registered as an active member of "${club.name}".`,
    link: `/clubs/${clubId}`,
  });

  return rows[0];
}

