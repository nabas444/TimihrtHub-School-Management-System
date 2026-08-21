import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { Role, NotificationType } from "@prisma/client";
import { emitToUser } from "../../config/socket";

let tablesInitialized = false;

export async function ensureCurriculumTables() {
  if (tablesInitialized) return;
  try {
    // 1. Curriculum Standards
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS curriculum_standards (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        subject_id VARCHAR NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        grade_level_id VARCHAR REFERENCES grade_levels(id) ON DELETE SET NULL,
        curriculum_id VARCHAR REFERENCES lookup_values(id) ON DELETE SET NULL,
        code VARCHAR NOT NULL,
        title VARCHAR NOT NULL,
        description TEXT,
        category VARCHAR,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_curriculum_standard_code UNIQUE (school_id, subject_id, code)
      )
    `);

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_curr_standards_lookup ON curriculum_standards (school_id, subject_id, grade_level_id)
    `);

    // 2. Curriculum Units
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS curriculum_units (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        subject_id VARCHAR NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        grade_level_id VARCHAR NOT NULL REFERENCES grade_levels(id) ON DELETE CASCADE,
        curriculum_id VARCHAR REFERENCES lookup_values(id) ON DELETE SET NULL,
        academic_year VARCHAR NOT NULL,
        unit_number INT DEFAULT 1,
        title VARCHAR NOT NULL,
        description TEXT,
        duration_weeks INT,
        start_date TIMESTAMPTZ,
        end_date TIMESTAMPTZ,
        learning_objectives JSONB,
        assessment_method TEXT,
        key_resources JSONB,
        status VARCHAR NOT NULL DEFAULT 'DRAFT',
        created_by_id VARCHAR NOT NULL REFERENCES users(id),
        teacher_profile_id VARCHAR REFERENCES teacher_profiles(id) ON DELETE SET NULL,
        submitted_at TIMESTAMPTZ,
        reviewed_by_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMPTZ,
        review_notes TEXT,
        current_version INT DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_curr_units_lookup ON curriculum_units (school_id, subject_id, grade_level_id, academic_year)
    `);

    // 3. Curriculum Unit Standards (Many-to-Many join)
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS curriculum_unit_standards (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        curriculum_unit_id VARCHAR NOT NULL REFERENCES curriculum_units(id) ON DELETE CASCADE,
        standard_id VARCHAR NOT NULL REFERENCES curriculum_standards(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_curr_unit_standard UNIQUE (curriculum_unit_id, standard_id)
      )
    `);

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_curr_unit_standards_unit ON curriculum_unit_standards (curriculum_unit_id)
    `);

    // 4. Curriculum Unit Versions (History snapshots)
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS curriculum_unit_versions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        curriculum_unit_id VARCHAR NOT NULL REFERENCES curriculum_units(id) ON DELETE CASCADE,
        version_number INT NOT NULL,
        snapshot JSONB NOT NULL,
        change_summary TEXT,
        created_by_id VARCHAR NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_curr_unit_versions_unit ON curriculum_unit_versions (curriculum_unit_id, version_number)
    `);

    tablesInitialized = true;
  } catch (err) {
    tablesInitialized = true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. STANDARDS CATALOG
// ─────────────────────────────────────────────────────────────────────────────

export async function listStandards(
  schoolId: string,
  filter: {
    subjectId?: string;
    gradeLevelId?: string;
    curriculumId?: string;
    category?: string;
    search?: string;
    isActive?: boolean;
  },
) {
  await ensureCurriculumTables();

  const whereClause: string[] = ["cs.school_id = $1"];
  const params: any[] = [schoolId];
  let paramIdx = 2;

  if (filter.subjectId) {
    whereClause.push(`cs.subject_id = $${paramIdx++}`);
    params.push(filter.subjectId);
  }
  if (filter.gradeLevelId) {
    whereClause.push(`(cs.grade_level_id = $${paramIdx++} OR cs.grade_level_id IS NULL)`);
    params.push(filter.gradeLevelId);
  }
  if (filter.curriculumId) {
    whereClause.push(`(cs.curriculum_id = $${paramIdx++} OR cs.curriculum_id IS NULL)`);
    params.push(filter.curriculumId);
  }
  if (filter.category) {
    whereClause.push(`cs.category = $${paramIdx++}`);
    params.push(filter.category);
  }
  if (filter.isActive !== undefined) {
    whereClause.push(`cs.is_active = $${paramIdx++}`);
    params.push(filter.isActive);
  }
  if (filter.search) {
    whereClause.push(
      `(cs.code ILIKE $${paramIdx} OR cs.title ILIKE $${paramIdx} OR cs.description ILIKE $${paramIdx})`,
    );
    params.push(`%${filter.search}%`);
    paramIdx++;
  }

  const query = `
    SELECT
      cs.id,
      cs.school_id as "schoolId",
      cs.subject_id as "subjectId",
      cs.grade_level_id as "gradeLevelId",
      cs.curriculum_id as "curriculumId",
      cs.code,
      cs.title,
      cs.description,
      cs.category,
      cs.is_active as "isActive",
      cs.created_at as "createdAt",
      cs.updated_at as "updatedAt",
      json_build_object('id', s.id, 'name', s.name, 'code', s.code) as subject,
      CASE WHEN gl.id IS NOT NULL THEN json_build_object('id', gl.id, 'name', gl.name, 'level', gl.level) ELSE NULL END as "gradeLevel",
      CASE WHEN lv.id IS NOT NULL THEN json_build_object('id', lv.id, 'value', lv.value) ELSE NULL END as curriculum,
      (SELECT COUNT(*)::int FROM curriculum_unit_standards cus WHERE cus.standard_id = cs.id) as "unitCount"
    FROM curriculum_standards cs
    JOIN subjects s ON cs.subject_id = s.id
    LEFT JOIN grade_levels gl ON cs.grade_level_id = gl.id
    LEFT JOIN lookup_values lv ON cs.curriculum_id = lv.id
    WHERE ${whereClause.join(" AND ")}
    ORDER BY s.name ASC, cs.code ASC
  `;

  const standards: any[] = await db.$queryRawUnsafe(query, ...params);
  return standards;
}

export async function createStandard(
  schoolId: string,
  data: {
    subjectId: string;
    gradeLevelId?: string | null;
    curriculumId?: string | null;
    code: string;
    title: string;
    description?: string | null;
    category?: string | null;
  },
) {
  await ensureCurriculumTables();

  const existing = await db.$queryRawUnsafe<any[]>(
    `SELECT id FROM curriculum_standards WHERE school_id = $1 AND subject_id = $2 AND UPPER(code) = UPPER($3)`,
    schoolId,
    data.subjectId,
    data.code.trim(),
  );

  if (existing.length > 0) {
    throw new AppError(`A standard with code "${data.code}" already exists for this subject`, 400);
  }

  const rows: any[] = await db.$queryRawUnsafe(
    `
    INSERT INTO curriculum_standards (
      school_id, subject_id, grade_level_id, curriculum_id, code, title, description, category, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
    RETURNING
      id, school_id as "schoolId", subject_id as "subjectId",
      grade_level_id as "gradeLevelId", curriculum_id as "curriculumId",
      code, title, description, category, is_active as "isActive",
      created_at as "createdAt", updated_at as "updatedAt"
  `,
    schoolId,
    data.subjectId,
    data.gradeLevelId || null,
    data.curriculumId || null,
    data.code.trim(),
    data.title.trim(),
    data.description || null,
    data.category || null,
  );

  return rows[0];
}

export async function updateStandard(
  schoolId: string,
  id: string,
  data: {
    code?: string;
    title?: string;
    description?: string | null;
    category?: string | null;
    gradeLevelId?: string | null;
    curriculumId?: string | null;
    isActive?: boolean;
  },
) {
  await ensureCurriculumTables();

  const standard = await db.$queryRawUnsafe<any[]>(
    `SELECT id, subject_id FROM curriculum_standards WHERE id = $1 AND school_id = $2`,
    id,
    schoolId,
  );
  if (!standard.length) throw new AppError("Curriculum standard not found", 404);

  if (data.code) {
    const dup = await db.$queryRawUnsafe<any[]>(
      `SELECT id FROM curriculum_standards WHERE school_id = $1 AND subject_id = $2 AND UPPER(code) = UPPER($3) AND id != $4`,
      schoolId,
      standard[0].subject_id,
      data.code.trim(),
      id,
    );
    if (dup.length > 0) {
      throw new AppError(`A standard with code "${data.code}" already exists for this subject`, 400);
    }
  }

  const rows: any[] = await db.$queryRawUnsafe(
    `
    UPDATE curriculum_standards
    SET
      code = COALESCE($3, code),
      title = COALESCE($4, title),
      description = CASE WHEN $5 IS NOT NULL THEN $5 ELSE description END,
      category = CASE WHEN $6 IS NOT NULL THEN $6 ELSE category END,
      grade_level_id = CASE WHEN $7 IS NOT NULL THEN $7 ELSE grade_level_id END,
      curriculum_id = CASE WHEN $8 IS NOT NULL THEN $8 ELSE curriculum_id END,
      is_active = COALESCE($9, is_active),
      updated_at = NOW()
    WHERE id = $1 AND school_id = $2
    RETURNING
      id, school_id as "schoolId", subject_id as "subjectId",
      grade_level_id as "gradeLevelId", curriculum_id as "curriculumId",
      code, title, description, category, is_active as "isActive",
      created_at as "createdAt", updated_at as "updatedAt"
  `,
    id,
    schoolId,
    data.code ? data.code.trim() : null,
    data.title ? data.title.trim() : null,
    data.description !== undefined ? data.description : null,
    data.category !== undefined ? data.category : null,
    data.gradeLevelId !== undefined ? data.gradeLevelId : null,
    data.curriculumId !== undefined ? data.curriculumId : null,
    data.isActive !== undefined ? data.isActive : null,
  );

  return rows[0];
}

export async function deleteStandard(schoolId: string, id: string) {
  await ensureCurriculumTables();
  const rows: any[] = await db.$queryRawUnsafe(
    `DELETE FROM curriculum_standards WHERE id = $1 AND school_id = $2 RETURNING id`,
    id,
    schoolId,
  );
  if (!rows.length) throw new AppError("Curriculum standard not found", 404);
  return { id };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CURRICULUM UNITS & SCOPE & SEQUENCE
// ─────────────────────────────────────────────────────────────────────────────

export async function listUnits(
  schoolId: string,
  filter: {
    subjectId?: string;
    gradeLevelId?: string;
    curriculumId?: string;
    academicYear?: string;
    status?: string;
    search?: string;
    teacherProfileId?: string;
    createdById?: string;
    userRole?: string;
    userId?: string;
  },
) {
  await ensureCurriculumTables();

  const whereClause: string[] = ["cu.school_id = $1"];
  const params: any[] = [schoolId];
  let paramIdx = 2;

  if (filter.subjectId) {
    whereClause.push(`cu.subject_id = $${paramIdx++}`);
    params.push(filter.subjectId);
  }
  if (filter.gradeLevelId) {
    whereClause.push(`cu.grade_level_id = $${paramIdx++}`);
    params.push(filter.gradeLevelId);
  }
  if (filter.curriculumId) {
    whereClause.push(`cu.curriculum_id = $${paramIdx++}`);
    params.push(filter.curriculumId);
  }
  if (filter.academicYear) {
    whereClause.push(`cu.academic_year = $${paramIdx++}`);
    params.push(filter.academicYear);
  }
  if (filter.status) {
    whereClause.push(`cu.status = $${paramIdx++}`);
    params.push(filter.status);
  }
  if (filter.teacherProfileId) {
    whereClause.push(`cu.teacher_profile_id = $${paramIdx++}`);
    params.push(filter.teacherProfileId);
  }
  if (filter.createdById) {
    whereClause.push(`cu.created_by_id = $${paramIdx++}`);
    params.push(filter.createdById);
  }

  if (filter.search) {
    whereClause.push(
      `(cu.title ILIKE $${paramIdx} OR cu.description ILIKE $${paramIdx} OR s.name ILIKE $${paramIdx})`,
    );
    params.push(`%${filter.search}%`);
    paramIdx++;
  }

  if (filter.userRole === Role.TEACHER && filter.userId) {
    whereClause.push(
      `(cu.status = 'APPROVED' OR cu.created_by_id = $${paramIdx++})`,
    );
    params.push(filter.userId);
  }

  const query = `
    SELECT
      cu.id,
      cu.school_id as "schoolId",
      cu.subject_id as "subjectId",
      cu.grade_level_id as "gradeLevelId",
      cu.curriculum_id as "curriculumId",
      cu.academic_year as "academicYear",
      cu.unit_number as "unitNumber",
      cu.title,
      cu.description,
      cu.duration_weeks as "durationWeeks",
      cu.start_date as "startDate",
      cu.end_date as "endDate",
      cu.learning_objectives as "learningObjectives",
      cu.assessment_method as "assessmentMethod",
      cu.key_resources as "keyResources",
      cu.status,
      cu.created_by_id as "createdById",
      cu.teacher_profile_id as "teacherProfileId",
      cu.submitted_at as "submittedAt",
      cu.reviewed_by_id as "reviewedById",
      cu.reviewed_at as "reviewedAt",
      cu.review_notes as "reviewNotes",
      cu.current_version as "currentVersion",
      cu.created_at as "createdAt",
      cu.updated_at as "updatedAt",
      json_build_object('id', s.id, 'name', s.name, 'code', s.code) as subject,
      json_build_object('id', gl.id, 'name', gl.name, 'level', gl.level) as "gradeLevel",
      CASE WHEN lv.id IS NOT NULL THEN json_build_object('id', lv.id, 'value', lv.value) ELSE NULL END as curriculum,
      json_build_object('id', u.id, 'firstName', u."firstName", 'lastName', u."lastName", 'role', u.role) as "createdBy",
      CASE WHEN rev.id IS NOT NULL THEN json_build_object('id', rev.id, 'firstName', rev."firstName", 'lastName', rev."lastName") ELSE NULL END as "reviewedBy",
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', cs.id,
          'code', cs.code,
          'title', cs.title,
          'category', cs.category
        ))
        FROM curriculum_unit_standards cus
        JOIN curriculum_standards cs ON cus.standard_id = cs.id
        WHERE cus.curriculum_unit_id = cu.id
      ), '[]'::json) as standards,
      (SELECT COUNT(*)::int FROM curriculum_unit_versions cuv WHERE cuv.curriculum_unit_id = cu.id) as "versionCount"
    FROM curriculum_units cu
    JOIN subjects s ON cu.subject_id = s.id
    JOIN grade_levels gl ON cu.grade_level_id = gl.id
    LEFT JOIN lookup_values lv ON cu.curriculum_id = lv.id
    JOIN users u ON cu.created_by_id = u.id
    LEFT JOIN users rev ON cu.reviewed_by_id = rev.id
    WHERE ${whereClause.join(" AND ")}
    ORDER BY cu.academic_year DESC, gl.level ASC, s.name ASC, cu.unit_number ASC, cu.created_at ASC
  `;

  const units: any[] = await db.$queryRawUnsafe(query, ...params);
  return units;
}

export async function getUnit(schoolId: string, id: string) {
  await ensureCurriculumTables();

  const query = `
    SELECT
      cu.id,
      cu.school_id as "schoolId",
      cu.subject_id as "subjectId",
      cu.grade_level_id as "gradeLevelId",
      cu.curriculum_id as "curriculumId",
      cu.academic_year as "academicYear",
      cu.unit_number as "unitNumber",
      cu.title,
      cu.description,
      cu.duration_weeks as "durationWeeks",
      cu.start_date as "startDate",
      cu.end_date as "endDate",
      cu.learning_objectives as "learningObjectives",
      cu.assessment_method as "assessmentMethod",
      cu.key_resources as "keyResources",
      cu.status,
      cu.created_by_id as "createdById",
      cu.teacher_profile_id as "teacherProfileId",
      cu.submitted_at as "submittedAt",
      cu.reviewed_by_id as "reviewedById",
      cu.reviewed_at as "reviewedAt",
      cu.review_notes as "reviewNotes",
      cu.current_version as "currentVersion",
      cu.created_at as "createdAt",
      cu.updated_at as "updatedAt",
      json_build_object('id', s.id, 'name', s.name, 'code', s.code) as subject,
      json_build_object('id', gl.id, 'name', gl.name, 'level', gl.level) as "gradeLevel",
      CASE WHEN lv.id IS NOT NULL THEN json_build_object('id', lv.id, 'value', lv.value) ELSE NULL END as curriculum,
      json_build_object('id', u.id, 'firstName', u."firstName", 'lastName', u."lastName", 'role', u.role) as "createdBy",
      CASE WHEN rev.id IS NOT NULL THEN json_build_object('id', rev.id, 'firstName', rev."firstName", 'lastName', rev."lastName") ELSE NULL END as "reviewedBy",
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', cs.id,
          'code', cs.code,
          'title', cs.title,
          'description', cs.description,
          'category', cs.category
        ))
        FROM curriculum_unit_standards cus
        JOIN curriculum_standards cs ON cus.standard_id = cs.id
        WHERE cus.curriculum_unit_id = cu.id
      ), '[]'::json) as standards
    FROM curriculum_units cu
    JOIN subjects s ON cu.subject_id = s.id
    JOIN grade_levels gl ON cu.grade_level_id = gl.id
    LEFT JOIN lookup_values lv ON cu.curriculum_id = lv.id
    JOIN users u ON cu.created_by_id = u.id
    LEFT JOIN users rev ON cu.reviewed_by_id = rev.id
    WHERE cu.id = $1 AND cu.school_id = $2
  `;

  const rows: any[] = await db.$queryRawUnsafe(query, id, schoolId);
  if (!rows.length) throw new AppError("Curriculum unit not found", 404);
  return rows[0];
}

export async function createUnit(
  schoolId: string,
  userId: string,
  userRole: string,
  data: {
    subjectId: string;
    gradeLevelId: string;
    curriculumId?: string | null;
    academicYear: string;
    unitNumber?: number;
    title: string;
    description?: string | null;
    durationWeeks?: number | null;
    startDate?: string | null;
    endDate?: string | null;
    learningObjectives?: any[];
    assessmentMethod?: string | null;
    keyResources?: any[];
    standardIds?: string[];
  },
) {
  await ensureCurriculumTables();

  let teacherProfileId: string | null = null;

  if (userRole === Role.TEACHER) {
    const teacher = await db.teacherProfile.findUnique({
      where: { userId },
    });
    if (!teacher) {
      throw new AppError("Teacher profile not found for user", 400);
    }
    teacherProfileId = teacher.id;

    const teaching = await db.subjectTeaching.findFirst({
      where: {
        teacherProfileId: teacher.id,
        subjectId: data.subjectId,
      },
    });

    if (!teaching) {
      throw new AppError("You can only create curriculum units for subjects you are assigned to teach", 403);
    }
  }

  let unitNumber = data.unitNumber;
  if (!unitNumber) {
    const maxNumRes: any[] = await db.$queryRawUnsafe(
      `SELECT COALESCE(MAX(unit_number), 0) + 1 as next_num FROM curriculum_units WHERE school_id = $1 AND subject_id = $2 AND grade_level_id = $3 AND academic_year = $4`,
      schoolId,
      data.subjectId,
      data.gradeLevelId,
      data.academicYear,
    );
    unitNumber = maxNumRes[0]?.next_num || 1;
  }

  const rows: any[] = await db.$queryRawUnsafe(
    `
    INSERT INTO curriculum_units (
      school_id, subject_id, grade_level_id, curriculum_id, academic_year,
      unit_number, title, description, duration_weeks, start_date, end_date,
      learning_objectives, assessment_method, key_resources, status,
      created_by_id, teacher_profile_id, current_version
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10, $11,
      $12::jsonb, $13, $14::jsonb, 'DRAFT',
      $15, $16, 1
    )
    RETURNING id
  `,
    schoolId,
    data.subjectId,
    data.gradeLevelId,
    data.curriculumId || null,
    data.academicYear,
    unitNumber,
    data.title.trim(),
    data.description || null,
    data.durationWeeks || null,
    data.startDate || null,
    data.endDate || null,
    JSON.stringify(data.learningObjectives || []),
    data.assessmentMethod || null,
    JSON.stringify(data.keyResources || []),
    userId,
    teacherProfileId,
  );

  const unitId = rows[0].id;

  if (data.standardIds && data.standardIds.length > 0) {
    for (const sid of data.standardIds) {
      await db.$executeRawUnsafe(
        `INSERT INTO curriculum_unit_standards (curriculum_unit_id, standard_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        unitId,
        sid,
      );
    }
  }

  return getUnit(schoolId, unitId);
}

export async function updateUnit(
  schoolId: string,
  id: string,
  userId: string,
  userRole: string,
  data: {
    title?: string;
    description?: string | null;
    unitNumber?: number;
    durationWeeks?: number | null;
    startDate?: string | null;
    endDate?: string | null;
    learningObjectives?: any[];
    assessmentMethod?: string | null;
    keyResources?: any[];
    standardIds?: string[];
    changeSummary?: string;
  },
) {
  await ensureCurriculumTables();

  const currentUnit = await getUnit(schoolId, id);
  const isSchoolAdmin = userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN;
  const isAuthor = currentUnit.createdById === userId;

  if (!isSchoolAdmin && !isAuthor) {
    throw new AppError("You do not have permission to edit this curriculum unit", 403);
  }

  if (currentUnit.status === "APPROVED") {
    const versionNum = currentUnit.currentVersion || 1;
    await db.$executeRawUnsafe(
      `
      INSERT INTO curriculum_unit_versions (
        curriculum_unit_id, version_number, snapshot, change_summary, created_by_id
      ) VALUES ($1, $2, $3::jsonb, $4, $5)
    `,
      id,
      versionNum,
      JSON.stringify(currentUnit),
      data.changeSummary || `Version ${versionNum} approved snapshot`,
      userId,
    );

    await db.$executeRawUnsafe(
      `UPDATE curriculum_units SET current_version = current_version + 1, status = 'DRAFT' WHERE id = $1`,
      id,
    );
  }

  await db.$executeRawUnsafe(
    `
    UPDATE curriculum_units
    SET
      title = COALESCE($3, title),
      description = CASE WHEN $4 IS NOT NULL THEN $4 ELSE description END,
      unit_number = COALESCE($5, unit_number),
      duration_weeks = CASE WHEN $6 IS NOT NULL THEN $6 ELSE duration_weeks END,
      start_date = CASE WHEN $7 IS NOT NULL THEN $7::timestamptz ELSE start_date END,
      end_date = CASE WHEN $8 IS NOT NULL THEN $8::timestamptz ELSE end_date END,
      learning_objectives = CASE WHEN $9 IS NOT NULL THEN $9::jsonb ELSE learning_objectives END,
      assessment_method = CASE WHEN $10 IS NOT NULL THEN $10 ELSE assessment_method END,
      key_resources = CASE WHEN $11 IS NOT NULL THEN $11::jsonb ELSE key_resources END,
      updated_at = NOW()
    WHERE id = $1 AND school_id = $2
  `,
    id,
    schoolId,
    data.title ? data.title.trim() : null,
    data.description !== undefined ? data.description : null,
    data.unitNumber !== undefined ? data.unitNumber : null,
    data.durationWeeks !== undefined ? data.durationWeeks : null,
    data.startDate !== undefined ? data.startDate : null,
    data.endDate !== undefined ? data.endDate : null,
    data.learningObjectives !== undefined ? JSON.stringify(data.learningObjectives) : null,
    data.assessmentMethod !== undefined ? data.assessmentMethod : null,
    data.keyResources !== undefined ? JSON.stringify(data.keyResources) : null,
  );

  if (data.standardIds !== undefined) {
    await db.$executeRawUnsafe(`DELETE FROM curriculum_unit_standards WHERE curriculum_unit_id = $1`, id);
    for (const sid of data.standardIds) {
      await db.$executeRawUnsafe(
        `INSERT INTO curriculum_unit_standards (curriculum_unit_id, standard_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        id,
        sid,
      );
    }
  }

  return getUnit(schoolId, id);
}

export async function deleteUnit(schoolId: string, id: string, userId: string, userRole: string) {
  await ensureCurriculumTables();
  const unit = await getUnit(schoolId, id);
  const isSchoolAdmin = userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN;
  const isAuthor = unit.createdById === userId;

  if (!isSchoolAdmin && (!isAuthor || unit.status === "APPROVED")) {
    throw new AppError("You do not have permission to delete this unit", 403);
  }

  await db.$executeRawUnsafe(`DELETE FROM curriculum_units WHERE id = $1 AND school_id = $2`, id, schoolId);
  return { id };
}

export async function submitUnit(schoolId: string, id: string, userId: string, userRole: string) {
  await ensureCurriculumTables();
  const unit = await getUnit(schoolId, id);

  const isSchoolAdmin = userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN;
  if (unit.createdById !== userId && !isSchoolAdmin) {
    throw new AppError("Only the author or an administrator can submit this unit", 403);
  }

  await db.$executeRawUnsafe(
    `UPDATE curriculum_units SET status = 'SUBMITTED', submitted_at = NOW(), updated_at = NOW() WHERE id = $1 AND school_id = $2`,
    id,
    schoolId,
  );

  const admins = await db.user.findMany({
    where: { schoolId, role: { in: [Role.ADMIN, Role.SUPER_ADMIN] }, isActive: true },
    select: { id: true },
  });

  const authorName = `${unit.createdBy?.firstName || ""} ${unit.createdBy?.lastName || ""}`.trim();
  for (const admin of admins) {
    await db.notification.create({
      data: {
        schoolId,
        userId: admin.id,
        type: NotificationType.CURRICULUM,
        title: "Curriculum Unit Submitted",
        body: `${authorName} submitted curriculum unit "${unit.title}" for ${unit.subject?.name} (${unit.gradeLevel?.name}) for review.`,
      },
    });
    emitToUser(admin.id, "notification", {
      type: NotificationType.CURRICULUM,
      title: "Curriculum Unit Submitted",
      message: `${authorName} submitted a curriculum unit for review.`,
    });
  }

  return getUnit(schoolId, id);
}

export async function reviewUnit(
  schoolId: string,
  id: string,
  reviewerId: string,
  decision: "APPROVED" | "REVISION_REQUESTED",
  notes?: string,
) {
  await ensureCurriculumTables();
  const unit = await getUnit(schoolId, id);

  const targetStatus = decision === "APPROVED" ? "APPROVED" : "REVISION_REQUESTED";

  await db.$executeRawUnsafe(
    `
    UPDATE curriculum_units
    SET
      status = $3,
      reviewed_by_id = $4,
      reviewed_at = NOW(),
      review_notes = $5,
      updated_at = NOW()
    WHERE id = $1 AND school_id = $2
  `,
    id,
    schoolId,
    targetStatus,
    reviewerId,
    notes || null,
  );

  const decisionTitle =
    decision === "APPROVED"
      ? "Curriculum Unit Approved"
      : "Curriculum Unit Revision Requested";

  const decisionBody =
    decision === "APPROVED"
      ? `Your curriculum unit "${unit.title}" has been approved by the department head / admin.`
      : `Your curriculum unit "${unit.title}" requires revisions. Notes: ${notes || "Please check with department lead."}`;

  await db.notification.create({
    data: {
      schoolId,
      userId: unit.createdById,
      type: NotificationType.CURRICULUM,
      title: decisionTitle,
      body: decisionBody,
    },
  });

  emitToUser(unit.createdById, "notification", {
    type: NotificationType.CURRICULUM,
    title: decisionTitle,
    message: decisionBody,
  });

  return getUnit(schoolId, id);
}

export async function getUnitVersions(schoolId: string, unitId: string) {
  await ensureCurriculumTables();
  await getUnit(schoolId, unitId);

  const query = `
    SELECT
      cuv.id,
      cuv.curriculum_unit_id as "curriculumUnitId",
      cuv.version_number as "versionNumber",
      cuv.snapshot,
      cuv.change_summary as "changeSummary",
      cuv.created_by_id as "createdById",
      cuv.created_at as "createdAt",
      json_build_object('id', u.id, 'firstName', u."firstName", 'lastName', u."lastName") as "createdBy"
    FROM curriculum_unit_versions cuv
    JOIN users u ON cuv.created_by_id = u.id
    WHERE cuv.curriculum_unit_id = $1
    ORDER BY cuv.version_number DESC
  `;

  const versions: any[] = await db.$queryRawUnsafe(query, unitId);
  return versions;
}
