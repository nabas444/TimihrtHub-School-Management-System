import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { Role, NotificationType } from "@prisma/client";
import { emitToUser } from "../../config/socket";

let tablesInitialized = false;

export async function ensurePolicyTables() {
  if (tablesInitialized) return;
  try {
    // 1. Policies Table
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS policies (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        category VARCHAR NOT NULL DEFAULT 'OTHER',
        title VARCHAR NOT NULL,
        summary TEXT,
        owner_id VARCHAR NOT NULL REFERENCES users(id),
        target_audience VARCHAR NOT NULL DEFAULT 'ALL_STAFF',
        is_publicly_visible BOOLEAN DEFAULT false,
        next_review_date TIMESTAMPTZ,
        review_interval_months INT DEFAULT 12,
        status VARCHAR NOT NULL DEFAULT 'DRAFT',
        current_version_id VARCHAR,
        created_by_id VARCHAR NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_policies_school_status ON policies (school_id, status, category)
    `);

    // 2. Policy Versions Table
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS policy_versions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        policy_id VARCHAR NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
        version_number VARCHAR NOT NULL,
        content TEXT NOT NULL,
        attachment_url TEXT,
        attachment_file_id VARCHAR,
        change_summary TEXT,
        status VARCHAR NOT NULL DEFAULT 'DRAFT',
        created_by_id VARCHAR NOT NULL REFERENCES users(id),
        submitted_at TIMESTAMPTZ,
        reviewed_by_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMPTZ,
        review_notes TEXT,
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_policy_version UNIQUE (policy_id, version_number)
      )
    `);

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_policy_versions_lookup ON policy_versions (policy_id, status)
    `);

    // 3. Policy Acknowledgments Table
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS policy_acknowledgments (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        policy_id VARCHAR NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
        policy_version_id VARCHAR NOT NULL REFERENCES policy_versions(id) ON DELETE CASCADE,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_acknowledged BOOLEAN DEFAULT false,
        acknowledged_at TIMESTAMPTZ,
        ip_address VARCHAR,
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_policy_user_ack UNIQUE (policy_version_id, user_id)
      )
    `);

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_policy_acks_user ON policy_acknowledgments (user_id, is_acknowledged)
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_policy_acks_policy ON policy_acknowledgments (policy_id, is_acknowledged)
    `);

    tablesInitialized = true;
  } catch (err) {
    tablesInitialized = true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. POLICIES CRUD & LISTINGS
// ─────────────────────────────────────────────────────────────────────────────

export async function listPolicies(
  schoolId: string,
  filter: {
    category?: string;
    status?: string;
    targetAudience?: string;
    search?: string;
    reviewDueSoon?: boolean;
    isPubliclyVisible?: boolean;
  },
) {
  await ensurePolicyTables();

  const whereClause: string[] = ["p.school_id = $1"];
  const params: any[] = [schoolId];
  let paramIdx = 2;

  if (filter.category) {
    whereClause.push(`p.category = $${paramIdx++}`);
    params.push(filter.category);
  }
  if (filter.status) {
    whereClause.push(`p.status = $${paramIdx++}`);
    params.push(filter.status);
  }
  if (filter.targetAudience) {
    whereClause.push(`p.target_audience = $${paramIdx++}`);
    params.push(filter.targetAudience);
  }
  if (filter.isPubliclyVisible !== undefined) {
    whereClause.push(`p.is_publicly_visible = $${paramIdx++}`);
    params.push(filter.isPubliclyVisible);
  }
  if (filter.reviewDueSoon) {
    whereClause.push(`p.next_review_date IS NOT NULL AND p.next_review_date <= (NOW() + INTERVAL '45 days')`);
  }
  if (filter.search) {
    whereClause.push(
      `(p.title ILIKE $${paramIdx} OR p.summary ILIKE $${paramIdx})`,
    );
    params.push(`%${filter.search}%`);
    paramIdx++;
  }

  const query = `
    SELECT
      p.id,
      p.school_id as "schoolId",
      p.category,
      p.title,
      p.summary,
      p.owner_id as "ownerId",
      p.target_audience as "targetAudience",
      p.is_publicly_visible as "isPubliclyVisible",
      p.next_review_date as "nextReviewDate",
      p.review_interval_months as "reviewIntervalMonths",
      p.status,
      p.current_version_id as "currentVersionId",
      p.created_by_id as "createdById",
      p.created_at as "createdAt",
      p.updated_at as "updatedAt",
      json_build_object('id', o.id, 'firstName', o."firstName", 'lastName', o."lastName", 'email', o.email) as owner,
      json_build_object('id', cb.id, 'firstName', cb."firstName", 'lastName', cb."lastName") as "createdBy",
      CASE WHEN pv.id IS NOT NULL THEN json_build_object(
        'id', pv.id,
        'versionNumber', pv.version_number,
        'publishedAt', pv.published_at,
        'attachmentUrl', pv.attachment_url
      ) ELSE NULL END as "currentVersion",
      (SELECT COUNT(*)::int FROM policy_versions pv2 WHERE pv2.policy_id = p.id) as "versionCount",
      (SELECT COUNT(*)::int FROM policy_acknowledgments pa WHERE pa.policy_id = p.id) as "totalTargetedCount",
      (SELECT COUNT(*)::int FROM policy_acknowledgments pa WHERE pa.policy_id = p.id AND pa.is_acknowledged = true) as "acknowledgedCount"
    FROM policies p
    JOIN users o ON p.owner_id = o.id
    JOIN users cb ON p.created_by_id = cb.id
    LEFT JOIN policy_versions pv ON p.current_version_id = pv.id
    WHERE ${whereClause.join(" AND ")}
    ORDER BY p.updated_at DESC
  `;

  const policies: any[] = await db.$queryRawUnsafe(query, ...params);
  return policies;
}

export async function getPolicy(schoolId: string, id: string) {
  await ensurePolicyTables();

  const query = `
    SELECT
      p.id,
      p.school_id as "schoolId",
      p.category,
      p.title,
      p.summary,
      p.owner_id as "ownerId",
      p.target_audience as "targetAudience",
      p.is_publicly_visible as "isPubliclyVisible",
      p.next_review_date as "nextReviewDate",
      p.review_interval_months as "reviewIntervalMonths",
      p.status,
      p.current_version_id as "currentVersionId",
      p.created_by_id as "createdById",
      p.created_at as "createdAt",
      p.updated_at as "updatedAt",
      json_build_object('id', o.id, 'firstName', o."firstName", 'lastName', o."lastName", 'email', o.email) as owner,
      json_build_object('id', cb.id, 'firstName', cb."firstName", 'lastName', cb."lastName") as "createdBy",
      CASE WHEN pv.id IS NOT NULL THEN json_build_object(
        'id', pv.id,
        'versionNumber', pv.version_number,
        'content', pv.content,
        'attachmentUrl', pv.attachment_url,
        'attachmentFileId', pv.attachment_file_id,
        'publishedAt', pv.published_at,
        'changeSummary', pv.change_summary
      ) ELSE NULL END as "currentVersion",
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', v.id,
          'versionNumber', v.version_number,
          'changeSummary', v.change_summary,
          'status', v.status,
          'attachmentUrl', v.attachment_url,
          'publishedAt', v.published_at,
          'createdAt', v.created_at,
          'submittedAt', v.submitted_at,
          'reviewedAt', v.reviewed_at,
          'reviewNotes', v.review_notes,
          'createdBy', json_build_object('id', vu.id, 'firstName', vu."firstName", 'lastName', vu."lastName"),
          'reviewedBy', CASE WHEN vr.id IS NOT NULL THEN json_build_object('id', vr.id, 'firstName', vr."firstName", 'lastName', vr."lastName") ELSE NULL END
        ) ORDER BY v.created_at DESC)
        FROM policy_versions v
        JOIN users vu ON v.created_by_id = vu.id
        LEFT JOIN users vr ON v.reviewed_by_id = vr.id
        WHERE v.policy_id = p.id
      ), '[]'::json) as versions,
      (SELECT COUNT(*)::int FROM policy_acknowledgments pa WHERE pa.policy_id = p.id) as "totalTargetedCount",
      (SELECT COUNT(*)::int FROM policy_acknowledgments pa WHERE pa.policy_id = p.id AND pa.is_acknowledged = true) as "acknowledgedCount"
    FROM policies p
    JOIN users o ON p.owner_id = o.id
    JOIN users cb ON p.created_by_id = cb.id
    LEFT JOIN policy_versions pv ON p.current_version_id = pv.id
    WHERE p.id = $1 AND p.school_id = $2
  `;

  const rows: any[] = await db.$queryRawUnsafe(query, id, schoolId);
  if (!rows.length) throw new AppError("Policy document not found", 404);
  return rows[0];
}

export async function createPolicy(
  schoolId: string,
  userId: string,
  data: {
    category: string;
    title: string;
    summary?: string | null;
    ownerId: string;
    targetAudience: string;
    isPubliclyVisible?: boolean;
    nextReviewDate?: string | null;
    reviewIntervalMonths?: number;
    initialContent: string;
    attachmentUrl?: string | null;
    attachmentFileId?: string | null;
  },
) {
  await ensurePolicyTables();

  const nextReview = data.nextReviewDate
    ? new Date(data.nextReviewDate)
    : new Date(Date.now() + (data.reviewIntervalMonths || 12) * 30 * 86400000);

  const policyRows: any[] = await db.$queryRawUnsafe(
    `
    INSERT INTO policies (
      school_id, category, title, summary, owner_id, target_audience,
      is_publicly_visible, next_review_date, review_interval_months, status,
      created_by_id
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, 'DRAFT',
      $10
    )
    RETURNING id
  `,
    schoolId,
    data.category,
    data.title.trim(),
    data.summary || null,
    data.ownerId,
    data.targetAudience,
    data.isPubliclyVisible ?? false,
    nextReview,
    data.reviewIntervalMonths || 12,
    userId,
  );

  const policyId = policyRows[0].id;

  // Create initial Version 1.0
  const versionRows: any[] = await db.$queryRawUnsafe(
    `
    INSERT INTO policy_versions (
      school_id, policy_id, version_number, content, attachment_url,
      attachment_file_id, change_summary, status, created_by_id
    ) VALUES (
      $1, $2, '1.0', $3, $4,
      $5, 'Initial policy draft', 'DRAFT', $6
    )
    RETURNING id
  `,
    schoolId,
    policyId,
    data.initialContent,
    data.attachmentUrl || null,
    data.attachmentFileId || null,
    userId,
  );

  const versionId = versionRows[0].id;

  await db.$executeRawUnsafe(
    `UPDATE policies SET current_version_id = $1 WHERE id = $2`,
    versionId,
    policyId,
  );

  return getPolicy(schoolId, policyId);
}

export async function updatePolicy(
  schoolId: string,
  id: string,
  userId: string,
  data: {
    category?: string;
    title?: string;
    summary?: string | null;
    ownerId?: string;
    targetAudience?: string;
    isPubliclyVisible?: boolean;
    nextReviewDate?: string | null;
    reviewIntervalMonths?: number;
  },
) {
  await ensurePolicyTables();
  await getPolicy(schoolId, id);

  await db.$executeRawUnsafe(
    `
    UPDATE policies
    SET
      category = COALESCE($3, category),
      title = COALESCE($4, title),
      summary = CASE WHEN $5 IS NOT NULL THEN $5 ELSE summary END,
      owner_id = COALESCE($6, owner_id),
      target_audience = COALESCE($7, target_audience),
      is_publicly_visible = COALESCE($8, is_publicly_visible),
      next_review_date = CASE WHEN $9 IS NOT NULL THEN $9::timestamptz ELSE next_review_date END,
      review_interval_months = COALESCE($10, review_interval_months),
      updated_at = NOW()
    WHERE id = $1 AND school_id = $2
  `,
    id,
    schoolId,
    data.category || null,
    data.title ? data.title.trim() : null,
    data.summary !== undefined ? data.summary : null,
    data.ownerId || null,
    data.targetAudience || null,
    data.isPubliclyVisible !== undefined ? data.isPubliclyVisible : null,
    data.nextReviewDate !== undefined ? data.nextReviewDate : null,
    data.reviewIntervalMonths || null,
  );

  return getPolicy(schoolId, id);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. VERSIONING & APPROVAL WORKFLOW
// ─────────────────────────────────────────────────────────────────────────────

export async function createPolicyVersion(
  schoolId: string,
  policyId: string,
  userId: string,
  data: {
    versionNumber: string;
    content: string;
    attachmentUrl?: string | null;
    attachmentFileId?: string | null;
    changeSummary: string;
  },
) {
  await ensurePolicyTables();
  await getPolicy(schoolId, policyId);

  const existing = await db.$queryRawUnsafe<any[]>(
    `SELECT id FROM policy_versions WHERE policy_id = $1 AND version_number = $2`,
    policyId,
    data.versionNumber.trim(),
  );
  if (existing.length > 0) {
    throw new AppError(`Version ${data.versionNumber} already exists for this policy`, 400);
  }

  const rows: any[] = await db.$queryRawUnsafe(
    `
    INSERT INTO policy_versions (
      school_id, policy_id, version_number, content, attachment_url,
      attachment_file_id, change_summary, status, created_by_id
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, 'DRAFT', $8
    )
    RETURNING id
  `,
    schoolId,
    policyId,
    data.versionNumber.trim(),
    data.content,
    data.attachmentUrl || null,
    data.attachmentFileId || null,
    data.changeSummary.trim(),
    userId,
  );

  return getPolicy(schoolId, policyId);
}

export async function submitPolicyVersion(schoolId: string, versionId: string, userId: string) {
  await ensurePolicyTables();

  const versionRes: any[] = await db.$queryRawUnsafe(
    `
    SELECT pv.id, pv.policy_id, pv.version_number, p.title, u."firstName", u."lastName"
    FROM policy_versions pv
    JOIN policies p ON pv.policy_id = p.id
    JOIN users u ON pv.created_by_id = u.id
    WHERE pv.id = $1 AND pv.school_id = $2
  `,
    versionId,
    schoolId,
  );

  if (!versionRes.length) throw new AppError("Policy version not found", 404);
  const version = versionRes[0];

  await db.$executeRawUnsafe(
    `UPDATE policy_versions SET status = 'SUBMITTED', submitted_at = NOW(), updated_at = NOW() WHERE id = $1`,
    versionId,
  );
  await db.$executeRawUnsafe(
    `UPDATE policies SET status = 'SUBMITTED', updated_at = NOW() WHERE id = $1`,
    version.policy_id,
  );

  // Notify admins
  const admins = await db.user.findMany({
    where: { schoolId, role: { in: [Role.ADMIN, Role.SUPER_ADMIN] }, isActive: true },
    select: { id: true },
  });

  const authorName = `${version.firstName} ${version.lastName}`;
  for (const admin of admins) {
    await db.notification.create({
      data: {
        schoolId,
        userId: admin.id,
        type: NotificationType.POLICY,
        title: "Policy Revision Submitted",
        body: `${authorName} submitted v${version.version_number} of policy "${version.title}" for review.`,
      },
    });
    emitToUser(admin.id, "notification", {
      type: NotificationType.POLICY,
      title: "Policy Revision Submitted",
      message: `${authorName} submitted a policy revision for review.`,
    });
  }

  return getPolicy(schoolId, version.policy_id);
}

export async function reviewPolicyVersion(
  schoolId: string,
  versionId: string,
  reviewerId: string,
  decision: "APPROVED" | "REVISION_REQUESTED",
  reviewNotes?: string,
) {
  await ensurePolicyTables();

  const versionRes: any[] = await db.$queryRawUnsafe(
    `
    SELECT pv.id, pv.policy_id, pv.version_number, pv.created_by_id, p.title
    FROM policy_versions pv
    JOIN policies p ON pv.policy_id = p.id
    WHERE pv.id = $1 AND pv.school_id = $2
  `,
    versionId,
    schoolId,
  );

  if (!versionRes.length) throw new AppError("Policy version not found", 404);
  const version = versionRes[0];

  const targetStatus = decision === "APPROVED" ? "APPROVED" : "REVISION_REQUESTED";

  await db.$executeRawUnsafe(
    `
    UPDATE policy_versions
    SET
      status = $2,
      reviewed_by_id = $3,
      reviewed_at = NOW(),
      review_notes = $4,
      updated_at = NOW()
    WHERE id = $1
  `,
    versionId,
    targetStatus,
    reviewerId,
    reviewNotes || null,
  );

  await db.$executeRawUnsafe(
    `UPDATE policies SET status = $2, updated_at = NOW() WHERE id = $1`,
    version.policy_id,
    targetStatus,
  );

  const decisionTitle =
    decision === "APPROVED"
      ? "Policy Version Approved"
      : "Policy Revision Requested";

  const decisionBody =
    decision === "APPROVED"
      ? `v${version.version_number} of policy "${version.title}" has been approved and is ready for distribution.`
      : `v${version.version_number} of policy "${version.title}" requires revisions. Notes: ${reviewNotes || "Please review admin notes."}`;

  await db.notification.create({
    data: {
      schoolId,
      userId: version.created_by_id,
      type: NotificationType.POLICY,
      title: decisionTitle,
      body: decisionBody,
    },
  });

  emitToUser(version.created_by_id, "notification", {
    type: NotificationType.POLICY,
    title: decisionTitle,
    message: decisionBody,
  });

  return getPolicy(schoolId, version.policy_id);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PUBLISHING, DISTRIBUTION & ACKNOWLEDGMENT TRACKING
// ─────────────────────────────────────────────────────────────────────────────

export async function publishPolicy(
  schoolId: string,
  policyId: string,
  versionId: string,
  publisherId: string,
) {
  await ensurePolicyTables();

  const policy = await getPolicy(schoolId, policyId);
  const version = policy.versions.find((v: any) => v.id === versionId);
  if (!version) throw new AppError("Specified policy version not found", 404);

  // Update policy and version statuses
  await db.$executeRawUnsafe(
    `
    UPDATE policy_versions
    SET status = 'PUBLISHED', published_at = NOW(), updated_at = NOW()
    WHERE id = $1
  `,
    versionId,
  );

  // Set new review date based on review_interval_months
  const intervalMonths = policy.reviewIntervalMonths || 12;
  const nextReviewDate = new Date(Date.now() + intervalMonths * 30 * 86400000);

  await db.$executeRawUnsafe(
    `
    UPDATE policies
    SET
      status = 'PUBLISHED',
      current_version_id = $2,
      next_review_date = $3,
      updated_at = NOW()
    WHERE id = $1
  `,
    policyId,
    versionId,
    nextReviewDate,
  );

  // Determine targeted audience users
  let targetRoles: Role[] = [];
  if (policy.targetAudience === "ALL_STAFF") {
    targetRoles = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER, Role.FINANCE];
  } else if (policy.targetAudience === "TEACHERS") {
    targetRoles = [Role.TEACHER];
  } else if (policy.targetAudience === "STUDENTS") {
    targetRoles = [Role.STUDENT];
  } else if (policy.targetAudience === "PARENTS") {
    targetRoles = [Role.PARENT];
  } else if (policy.targetAudience === "ALL") {
    targetRoles = [
      Role.ADMIN,
      Role.SUPER_ADMIN,
      Role.TEACHER,
      Role.FINANCE,
      Role.STUDENT,
      Role.PARENT,
    ];
  } else {
    targetRoles = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER];
  }

  const targetUsers = await db.user.findMany({
    where: {
      schoolId,
      role: { in: targetRoles },
      isActive: true,
    },
    select: { id: true },
  });

  // Create acknowledgment-required records for each targeted user
  for (const u of targetUsers) {
    await db.$executeRawUnsafe(
      `
      INSERT INTO policy_acknowledgments (
        school_id, policy_id, policy_version_id, user_id, is_acknowledged
      ) VALUES ($1, $2, $3, $4, false)
      ON CONFLICT (policy_version_id, user_id) DO NOTHING
    `,
      schoolId,
      policyId,
      versionId,
      u.id,
    );

    // Send notification
    await db.notification.create({
      data: {
        schoolId,
        userId: u.id,
        type: NotificationType.POLICY,
        title: "Action Required: Policy Acknowledgment",
        body: `Please review and acknowledge the updated school policy: "${policy.title}" (v${version.versionNumber}).`,
        data: {
          policyId,
          versionId,
          link: `/policies/my-acknowledgments`,
        },
      },
    });

    emitToUser(u.id, "notification", {
      type: NotificationType.POLICY,
      title: "Action Required: Policy Acknowledgment",
      message: `Please review and acknowledge policy: "${policy.title}".`,
      link: `/policies/my-acknowledgments`,
    });
  }

  return getPolicy(schoolId, policyId);
}

export async function acknowledgePolicy(
  schoolId: string,
  versionId: string,
  userId: string,
  metadata?: { ipAddress?: string; userAgent?: string },
) {
  await ensurePolicyTables();

  const ackRes: any[] = await db.$queryRawUnsafe(
    `
    SELECT pa.id, pa.policy_id, p.title
    FROM policy_acknowledgments pa
    JOIN policies p ON pa.policy_id = p.id
    WHERE pa.policy_version_id = $1 AND pa.user_id = $2 AND pa.school_id = $3
  `,
    versionId,
    userId,
    schoolId,
  );

  if (!ackRes.length) {
    // If no prior ack record existed, create one on the fly
    const versionRes: any[] = await db.$queryRawUnsafe(
      `SELECT policy_id FROM policy_versions WHERE id = $1 AND school_id = $2`,
      versionId,
      schoolId,
    );
    if (!versionRes.length) throw new AppError("Policy version not found", 404);

    await db.$executeRawUnsafe(
      `
      INSERT INTO policy_acknowledgments (
        school_id, policy_id, policy_version_id, user_id, is_acknowledged, acknowledged_at, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, true, NOW(), $5, $6)
      ON CONFLICT (policy_version_id, user_id)
      DO UPDATE SET is_acknowledged = true, acknowledged_at = NOW(), ip_address = $5, user_agent = $6
    `,
      schoolId,
      versionRes[0].policy_id,
      versionId,
      userId,
      metadata?.ipAddress || null,
      metadata?.userAgent || null,
    );
  } else {
    await db.$executeRawUnsafe(
      `
      UPDATE policy_acknowledgments
      SET
        is_acknowledged = true,
        acknowledged_at = NOW(),
        ip_address = $3,
        user_agent = $4,
        updated_at = NOW()
      WHERE policy_version_id = $1 AND user_id = $2
    `,
      versionId,
      userId,
      metadata?.ipAddress || null,
      metadata?.userAgent || null,
    );
  }

  return { acknowledged: true, acknowledgedAt: new Date() };
}

export async function getAcknowledgmentReport(schoolId: string, policyId: string) {
  await ensurePolicyTables();
  const policy = await getPolicy(schoolId, policyId);

  const query = `
    SELECT
      pa.id,
      pa.policy_id as "policyId",
      pa.policy_version_id as "policyVersionId",
      pa.user_id as "userId",
      pa.is_acknowledged as "isAcknowledged",
      pa.acknowledged_at as "acknowledgedAt",
      pa.ip_address as "ipAddress",
      pv.version_number as "versionNumber",
      u."firstName" as "firstName",
      u."lastName" as "lastName",
      u.email,
      u.role
    FROM policy_acknowledgments pa
    JOIN policy_versions pv ON pa.policy_version_id = pv.id
    JOIN users u ON pa.user_id = u.id
    WHERE pa.policy_id = $1 AND pa.school_id = $2
    ORDER BY pa.is_acknowledged ASC, u."lastName" ASC
  `;

  const recipients: any[] = await db.$queryRawUnsafe(query, policyId, schoolId);

  const total = recipients.length;
  const acknowledged = recipients.filter((r) => r.isAcknowledged).length;
  const outstanding = total - acknowledged;
  const completionPercent = total > 0 ? Math.round((acknowledged / total) * 100) : 0;

  return {
    policy: {
      id: policy.id,
      title: policy.title,
      category: policy.category,
      targetAudience: policy.targetAudience,
      currentVersionNumber: policy.currentVersion?.versionNumber || "1.0",
      nextReviewDate: policy.nextReviewDate,
    },
    summary: {
      total,
      acknowledged,
      outstanding,
      completionPercent,
    },
    recipients,
  };
}

export async function getMyPendingAcknowledgments(schoolId: string, userId: string) {
  await ensurePolicyTables();

  const query = `
    SELECT
      pa.id as "acknowledgmentId",
      pa.policy_id as "policyId",
      pa.policy_version_id as "policyVersionId",
      pa.is_acknowledged as "isAcknowledged",
      pa.created_at as "assignedAt",
      p.title as "policyTitle",
      p.category as "policyCategory",
      p.summary as "policySummary",
      p.is_publicly_visible as "isPubliclyVisible",
      pv.version_number as "versionNumber",
      pv.content as "versionContent",
      pv.attachment_url as "attachmentUrl",
      pv.published_at as "publishedAt"
    FROM policy_acknowledgments pa
    JOIN policies p ON pa.policy_id = p.id
    JOIN policy_versions pv ON pa.policy_version_id = pv.id
    WHERE pa.school_id = $1 AND pa.user_id = $2 AND pa.is_acknowledged = false AND p.status = 'PUBLISHED'
    ORDER BY pa.created_at DESC
  `;

  const pending: any[] = await db.$queryRawUnsafe(query, schoolId, userId);
  return pending;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PUBLIC POLICIES (Unauthenticated Read for Safeguarding, etc.)
// ─────────────────────────────────────────────────────────────────────────────

export async function listPublicPolicies(schoolId: string, category?: string) {
  await ensurePolicyTables();

  const whereClause = ["p.school_id = $1", "p.is_publicly_visible = true", "p.status = 'PUBLISHED'"];
  const params: any[] = [schoolId];

  if (category) {
    whereClause.push("p.category = $2");
    params.push(category);
  }

  const query = `
    SELECT
      p.id,
      p.category,
      p.title,
      p.summary,
      p.updated_at as "lastUpdated",
      pv.version_number as "versionNumber",
      pv.content,
      pv.attachment_url as "attachmentUrl",
      pv.published_at as "publishedAt"
    FROM policies p
    JOIN policy_versions pv ON p.current_version_id = pv.id
    WHERE ${whereClause.join(" AND ")}
    ORDER BY p.title ASC
  `;

  const policies: any[] = await db.$queryRawUnsafe(query, ...params);
  return policies;
}

export async function getPublicPolicy(id: string) {
  await ensurePolicyTables();

  const query = `
    SELECT
      p.id,
      p.school_id as "schoolId",
      p.category,
      p.title,
      p.summary,
      p.updated_at as "lastUpdated",
      pv.version_number as "versionNumber",
      pv.content,
      pv.attachment_url as "attachmentUrl",
      pv.published_at as "publishedAt",
      json_build_object('name', s.name, 'logo', s.logo, 'website', s.website) as school
    FROM policies p
    JOIN schools s ON p.school_id = s.id
    JOIN policy_versions pv ON p.current_version_id = pv.id
    WHERE p.id = $1 AND p.is_publicly_visible = true AND p.status = 'PUBLISHED'
  `;

  const rows: any[] = await db.$queryRawUnsafe(query, id);
  if (!rows.length) throw new AppError("Public policy not found or not published", 404);
  return rows[0];
}
