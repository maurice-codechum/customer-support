import { sourcePool as pool } from "@/app/api/_lib/db";
import type { RosterRow } from "./types";

export type UniversityReportData = {
  universityId: string;
  dateRange: { from: string; to: string };
  utilization: { total: number; active: number; rate: number };
  byCollege: Array<{
    collegeId: number | null;
    collegeName: string;
    campusId: number;
    campusName: string;
    total: number;
    active: number;
    rate: number;
  }>;
  byDepartment: Array<{
    collegeId: number | null;
    collegeName: string;
    departmentId: number | null;
    departmentName: string;
    total: number;
    active: number;
    rate: number;
  }>;
  scannedPapers: number;
  activitiesCreated: number;
  assessments: Array<{
    collegeId: number | null;
    collegeName: string;
    itemType: string;
    totalTasks: number;
  }>;
  hoursSaved: number;
  topTeachers: Array<{
    teacherId: number;
    teacherName: string;
    collegeName: string;
    departmentName: string;
    activitiesCreated: number;
    scannedPapers: number;
  }>;
  listOfTeachers: TeacherListItem[];
};

export type TeacherListStatus = "active" | "inactive" | "no_account";

export type TeacherListItem = {
  number: number;
  teacherName: string;
  collegeOrDept: string;
  status: TeacherListStatus;
};

const UTILIZATION_SQL = `
  WITH teacher_scans AS (
    SELECT s.teacher_id, COUNT(DISTINCT rp.result_id) as scanned_papers
    FROM result_pages rp
    JOIN tasks t ON rp.task_id = t.id
    JOIN task_sections ts ON t.id = ts.task_id
    JOIN sections s ON ts.section_id = s.id
    WHERE rp.deleted IS NULL AND t.deleted IS NULL AND s.deleted IS NULL
      AND rp.datetime_created >= $1 AND rp.datetime_created <= $2
    GROUP BY s.teacher_id
  ),
  teacher_info AS (
    SELECT u.id as teacher_id, u.university_id, univ.name as university_name,
      COALESCE(u.campus_id, 0) as campus_id, COALESCE(camp.name, 'No Campus Assigned') as campus_name,
      cd.college_id, coll.name as college_name,
      u.campus_department_id, COALESCE(cd.name, d.name, 'No Department Assigned') as department_name,
      CASE WHEN COALESCE(ts.scanned_papers, 0) >= 5 THEN 1 ELSE 0 END as is_active
    FROM users u
    LEFT JOIN universities univ ON u.university_id = univ.id
    LEFT JOIN campuses camp ON u.campus_id = camp.id
    LEFT JOIN campus_departments cd ON u.campus_department_id = cd.id
    LEFT JOIN departments d ON cd.department_id = d.id
    LEFT JOIN campus_colleges coll ON cd.college_id = coll.id
    LEFT JOIN teacher_scans ts ON u.id = ts.teacher_id
    WHERE u.user_type = 'T' AND u.deleted IS NULL AND u.university_id = $3
  ),
  university_level AS (
    SELECT 'University' as level, university_name as name, 'All Campuses' as campus,
      COUNT(teacher_id) as total_teachers, SUM(is_active) as active_teachers,
      ROUND(SUM(is_active)::numeric / NULLIF(COUNT(teacher_id), 0) * 100, 2) as utilization_rate,
      university_id, -1 as campus_id, NULL::bigint as college_id, NULL::text as college_name,
      NULL::bigint as department_id, 0 as sort_order
    FROM teacher_info GROUP BY university_id, university_name
  ),
  college_level AS (
    SELECT 'College' as level, COALESCE(college_name, 'No College Assigned') as name, campus_name as campus,
      COUNT(teacher_id) as total_teachers, SUM(is_active) as active_teachers,
      ROUND(SUM(is_active)::numeric / NULLIF(COUNT(teacher_id), 0) * 100, 2) as utilization_rate,
      university_id, campus_id, college_id, COALESCE(college_name, 'No College Assigned') as college_name,
      NULL::bigint as department_id, 2 as sort_order
    FROM teacher_info GROUP BY university_id, campus_id, campus_name, college_id, college_name
  ),
  department_level AS (
    SELECT 'Department' as level, department_name as name, campus_name as campus,
      COUNT(teacher_id) as total_teachers, SUM(is_active) as active_teachers,
      ROUND(SUM(is_active)::numeric / NULLIF(COUNT(teacher_id), 0) * 100, 2) as utilization_rate,
      university_id, campus_id, college_id, COALESCE(college_name, 'No College Assigned') as college_name,
      campus_department_id as department_id, 3 as sort_order
    FROM teacher_info GROUP BY university_id, campus_id, campus_name, college_id, college_name, campus_department_id, department_name
  )
  SELECT level, name, campus, total_teachers, active_teachers,
    COALESCE(utilization_rate, 0) as utilization_rate, university_id, campus_id, college_id, college_name, department_id
  FROM (
    SELECT * FROM university_level
    UNION ALL SELECT * FROM college_level
    UNION ALL SELECT * FROM department_level
  ) combined
  ORDER BY sort_order, name
`;

const SCANNED_PAPERS_SQL = `
  SELECT COALESCE(SUM(scanned)::bigint, 0) as total_scanned
  FROM (
    SELECT COUNT(DISTINCT rp.result_id) as scanned
    FROM result_pages rp
    JOIN tasks t ON rp.task_id = t.id
    JOIN task_sections ts ON t.id = ts.task_id
    JOIN sections s ON ts.section_id = s.id
    JOIN users u ON s.teacher_id = u.id
    WHERE rp.deleted IS NULL AND t.deleted IS NULL AND s.deleted IS NULL
      AND u.deleted IS NULL AND u.user_type = 'T' AND u.university_id = $3
      AND rp.datetime_created >= $1 AND rp.datetime_created <= $2
    GROUP BY s.teacher_id
  ) ts
`;

const ACTIVITIES_CREATED_SQL = `
  SELECT COALESCE(COUNT(DISTINCT t.id), 0) as total_activities
  FROM tasks t
  JOIN task_sections ts ON t.id = ts.task_id
  JOIN sections s ON ts.section_id = s.id
  JOIN users u ON s.teacher_id = u.id
  WHERE t.deleted IS NULL AND s.deleted IS NULL AND u.deleted IS NULL
    AND u.user_type = 'T' AND u.university_id = $3
    AND t.datetime_created >= $1 AND t.datetime_created <= $2
`;

const ASSESSMENTS_SQL = `
  WITH all_colleges AS (
      SELECT univ.id as university_id, univ.name as university_name, cc.id as college_id, cc.name as college_name
      FROM universities univ
      JOIN campuses camp ON camp.university_id = univ.id
      JOIN campus_colleges cc ON cc.campus_id = camp.id
      WHERE univ.deleted IS NULL AND camp.deleted IS NULL AND cc.deleted IS NULL AND univ.id::text = $3
  ),
  valid_tasks AS (
      SELECT t.id as task_id, s.teacher_id
      FROM tasks t
      JOIN task_sections ts ON t.id = ts.task_id
      JOIN sections s ON ts.section_id = s.id
      JOIN result_pages rp ON rp.task_id = t.id
      WHERE t.deleted IS NULL AND s.deleted IS NULL AND rp.deleted IS NULL
        AND rp.datetime_created >= $1 AND rp.datetime_created <= $2
      GROUP BY t.id, s.teacher_id
  ),
  task_item_types AS (
      SELECT DISTINCT task_id, item_type FROM items
      WHERE deleted IS NULL AND item_type IN ('multiple_choice', 'identification', 'enumeration', 'essay', 'problem_solving', 'code_on_paper', 'visual')
  ),
  college_tasks AS (
      SELECT cc.id as college_id, tit.item_type, vt.task_id
      FROM valid_tasks vt
      JOIN task_item_types tit ON vt.task_id = tit.task_id
      JOIN users teacher ON vt.teacher_id = teacher.id
      JOIN campus_departments cd ON teacher.campus_department_id = cd.id
      JOIN campus_colleges cc ON cd.college_id = cc.id
      WHERE teacher.deleted IS NULL AND teacher.user_type = 'T'
  ),
  college_unique_tasks AS (
      SELECT cc.id as college_id, vt.task_id
      FROM valid_tasks vt
      JOIN users teacher ON vt.teacher_id = teacher.id
      JOIN campus_departments cd ON teacher.campus_department_id = cd.id
      JOIN campus_colleges cc ON cd.college_id = cc.id
      WHERE teacher.deleted IS NULL AND teacher.user_type = 'T'
  )
  SELECT ac.university_id, ac.university_name, ac.college_id, ac.college_name, ct.item_type, COUNT(DISTINCT ct.task_id) as total_tasks
  FROM all_colleges ac
  LEFT JOIN college_tasks ct ON ac.college_id = ct.college_id
  GROUP BY ac.university_id, ac.university_name, ac.college_id, ac.college_name, ct.item_type

  UNION ALL

  SELECT ac.university_id, ac.university_name, ac.college_id, ac.college_name, 'total_unique_tasks' as item_type, COUNT(DISTINCT cut.task_id) as total_tasks
  FROM all_colleges ac
  LEFT JOIN college_unique_tasks cut ON ac.college_id = cut.college_id
  GROUP BY ac.university_id, ac.university_name, ac.college_id, ac.college_name

  UNION ALL

  SELECT univ.id as university_id, univ.name as university_name, NULL as college_id, 'No College Assigned' as college_name, tit.item_type, COUNT(DISTINCT vt.task_id) as total_tasks
  FROM valid_tasks vt
  JOIN task_item_types tit ON vt.task_id = tit.task_id
  JOIN users teacher ON vt.teacher_id = teacher.id
  LEFT JOIN campus_departments cd ON teacher.campus_department_id = cd.id
  LEFT JOIN campuses camp ON teacher.campus_id = camp.id
  JOIN universities univ ON COALESCE(camp.university_id, teacher.university_id) = univ.id
  WHERE teacher.deleted IS NULL AND teacher.user_type = 'T' AND cd.college_id IS NULL AND univ.id::text = $3
  GROUP BY univ.id, univ.name, tit.item_type

  UNION ALL

  SELECT univ.id as university_id, univ.name as university_name, NULL as college_id, 'No College Assigned' as college_name, 'total_unique_tasks' as item_type, COUNT(DISTINCT vt.task_id) as total_tasks
  FROM valid_tasks vt
  JOIN users teacher ON vt.teacher_id = teacher.id
  LEFT JOIN campus_departments cd ON teacher.campus_department_id = cd.id
  LEFT JOIN campuses camp ON teacher.campus_id = camp.id
  JOIN universities univ ON COALESCE(camp.university_id, teacher.university_id) = univ.id
  WHERE teacher.deleted IS NULL AND teacher.user_type = 'T' AND cd.college_id IS NULL AND univ.id::text = $3
  GROUP BY univ.id, univ.name
`;

const TOP_TEACHERS_SQL = `
  WITH teacher_tasks AS (
    SELECT s.teacher_id, COUNT(DISTINCT t.id) as activities_created
    FROM tasks t
    JOIN task_sections ts ON t.id = ts.task_id
    JOIN sections s ON ts.section_id = s.id
    WHERE t.deleted IS NULL AND s.deleted IS NULL AND t.datetime_created >= $1 AND t.datetime_created <= $2
    GROUP BY s.teacher_id
  ),
  teacher_scans AS (
    SELECT s.teacher_id, COUNT(DISTINCT rp.id) as scanned_papers
    FROM result_pages rp
    JOIN tasks t ON rp.task_id = t.id
    JOIN task_sections ts ON t.id = ts.task_id
    JOIN sections s ON ts.section_id = s.id
    WHERE rp.deleted IS NULL AND t.deleted IS NULL AND s.deleted IS NULL AND rp.datetime_created >= $1 AND rp.datetime_created <= $2
    GROUP BY s.teacher_id
  )
  SELECT u.id as teacher_id, u.last_name || ', ' || u.first_name as teacher_name,
    COALESCE(coll.name, 'No College Assigned') as college_name,
    COALESCE(cd.name, d.name, 'No Department Assigned') as department_name,
    COALESCE(tt.activities_created, 0) as activities_created,
    COALESCE(ts.scanned_papers, 0) as scanned_papers
  FROM users u
  LEFT JOIN teacher_tasks tt ON u.id = tt.teacher_id
  LEFT JOIN teacher_scans ts ON u.id = ts.teacher_id
  LEFT JOIN campus_departments cd ON u.campus_department_id = cd.id
  LEFT JOIN departments d ON cd.department_id = d.id
  LEFT JOIN campus_colleges coll ON cd.college_id = coll.id
  WHERE u.user_type = 'T' AND u.deleted IS NULL AND u.university_id::text = $3
    AND (tt.activities_created > 0 OR ts.scanned_papers > 0)
  ORDER BY activities_created DESC, scanned_papers DESC
  LIMIT 5
`;

const ALL_TEACHERS_SQL = `
  WITH teacher_tasks AS (
    SELECT s.teacher_id, COUNT(DISTINCT t.id) as activities_created
    FROM tasks t
    JOIN task_sections ts ON t.id = ts.task_id
    JOIN sections s ON ts.section_id = s.id
    WHERE t.deleted IS NULL AND s.deleted IS NULL AND t.datetime_created >= $1 AND t.datetime_created <= $2
    GROUP BY s.teacher_id
  ),
  teacher_scans AS (
    SELECT s.teacher_id, COUNT(DISTINCT rp.id) as scanned_papers
    FROM result_pages rp
    JOIN tasks t ON rp.task_id = t.id
    JOIN task_sections ts ON t.id = ts.task_id
    JOIN sections s ON ts.section_id = s.id
    WHERE rp.deleted IS NULL AND t.deleted IS NULL AND s.deleted IS NULL AND rp.datetime_created >= $1 AND rp.datetime_created <= $2
    GROUP BY s.teacher_id
  )
  SELECT u.id as teacher_id,
    LOWER(COALESCE(u.email, '')) as email,
    u.last_name || ', ' || u.first_name as teacher_name,
    COALESCE(coll.name, 'No College Assigned') as college_name,
    COALESCE(cd.name, d.name, 'No Department Assigned') as department_name,
    COALESCE(tt.activities_created, 0) as activities_created,
    COALESCE(ts.scanned_papers, 0) as scanned_papers
  FROM users u
  LEFT JOIN teacher_tasks tt ON u.id = tt.teacher_id
  LEFT JOIN teacher_scans ts ON u.id = ts.teacher_id
  LEFT JOIN campus_departments cd ON u.campus_department_id = cd.id
  LEFT JOIN departments d ON cd.department_id = d.id
  LEFT JOIN campus_colleges coll ON cd.college_id = coll.id
  WHERE u.user_type = 'T' AND u.deleted IS NULL AND u.university_id::text = $3
`;

const MINUTES_PER_TASK: Record<string, number> = {
  multiple_choice: 80,
  identification: 80,
  code_on_paper: 80,
  enumeration: 40,
  essay: 200,
  problem_solving: 200,
  visual: 120,
};

function calculateHoursSaved(
  assessments: UniversityReportData["assessments"],
): number {
  let totalMinutes = 0;
  for (const r of assessments) {
    const m = MINUTES_PER_TASK[r.itemType];
    if (!m) continue;
    totalMinutes += (Number(r.totalTasks) || 0) * m;
  }
  return totalMinutes / 60;
}

export async function getUniversityReportData(params: {
  universityId: string;
  startDate: string;
  endDate: string;
  roster?: RosterRow[];
}): Promise<UniversityReportData> {
  const { universityId } = params;
  const from = params.startDate;
  const to =
    params.endDate.length === 10
      ? `${params.endDate} 23:59:59`
      : params.endDate;

  const args = [from, to, universityId];

  const [utilRes, scannedRes, activitiesRes, assessmentsRes, topRes, allRes] =
    await Promise.all([
      pool.query(UTILIZATION_SQL, args),
      pool.query(SCANNED_PAPERS_SQL, args),
      pool.query(ACTIVITIES_CREATED_SQL, args),
      pool.query(ASSESSMENTS_SQL, args),
      pool.query(TOP_TEACHERS_SQL, args),
      pool.query(ALL_TEACHERS_SQL, args),
    ]);

  const univRow = utilRes.rows.find((r: any) => r.level === "University");
  const utilization = {
    total: Number(univRow?.total_teachers ?? 0),
    active: Number(univRow?.active_teachers ?? 0),
    rate: Number(univRow?.utilization_rate ?? 0),
  };

  const byCollege = utilRes.rows
    .filter((r: any) => r.level === "College")
    .map((r: any) => ({
      collegeId: r.college_id === null ? null : Number(r.college_id),
      collegeName: r.name,
      campusId: Number(r.campus_id),
      campusName: r.campus,
      total: Number(r.total_teachers),
      active: Number(r.active_teachers),
      rate: Number(r.utilization_rate),
    }));

  const byDepartment = utilRes.rows
    .filter((r: any) => r.level === "Department")
    .map((r: any) => ({
      collegeId: r.college_id === null ? null : Number(r.college_id),
      collegeName: r.college_name ?? "No College Assigned",
      departmentId: r.department_id === null ? null : Number(r.department_id),
      departmentName: r.name,
      total: Number(r.total_teachers),
      active: Number(r.active_teachers),
      rate: Number(r.utilization_rate),
    }));

  const assessments = assessmentsRes.rows.map((r: any) => ({
    collegeId: r.college_id === null ? null : Number(r.college_id),
    collegeName: r.college_name,
    itemType: r.item_type,
    totalTasks: Number(r.total_tasks ?? 0),
  }));

  const topTeachersAll = topRes.rows.map((r: any) => ({
    teacherId: Number(r.teacher_id),
    teacherName: r.teacher_name,
    collegeName: r.college_name,
    departmentName: r.department_name,
    activitiesCreated: Number(r.activities_created),
    scannedPapers: Number(r.scanned_papers),
  }));
  const topTeachers =
    topTeachersAll.length < 5 ? topTeachersAll.slice(0, 3) : topTeachersAll;

  const listOfTeachers = buildListOfTeachers(allRes.rows, params.roster ?? []);

  let effectiveByCollege = byCollege;
  let effectiveByDepartment = byDepartment;
  let effectiveTopTeachers = topTeachers;
  let effectiveListOfTeachers = listOfTeachers;

  const MAPUA_UNIVERSITY_ID = "5";
  if (universityId === MAPUA_UNIVERSITY_ID) {
    const campusFallback = byCollege[0];
    effectiveByCollege = byDepartment.map((d) => ({
      collegeId: d.departmentId,
      collegeName: d.departmentName,
      campusId: campusFallback?.campusId ?? 0,
      campusName: campusFallback?.campusName ?? "",
      total: d.total,
      active: d.active,
      rate: d.rate,
    }));
    effectiveByDepartment = [];
    effectiveTopTeachers = topTeachers.map((t) =>
      !t.collegeName || t.collegeName === "No College Assigned"
        ? { ...t, collegeName: t.departmentName }
        : t,
    );

    const MAPUA_DEPT_RENAMES: Record<string, string> = {
      "school of nursing": "Nursing",
      mathematics: "Math",
    };
    effectiveListOfTeachers = listOfTeachers
      .map((t) => {
        const key = (t.collegeOrDept ?? "").trim().toLowerCase();
        const renamed = MAPUA_DEPT_RENAMES[key];
        return renamed ? { ...t, collegeOrDept: renamed } : t;
      })
      .sort((a, b) => {
        const byGroup = a.collegeOrDept.localeCompare(
          b.collegeOrDept,
          undefined,
          { sensitivity: "base" },
        );
        if (byGroup !== 0) return byGroup;
        return a.teacherName.localeCompare(b.teacherName, undefined, {
          sensitivity: "base",
        });
      })
      .map((t, i) => ({ ...t, number: i + 1 }));
  }

  return {
    universityId,
    dateRange: { from, to },
    utilization,
    byCollege: effectiveByCollege,
    byDepartment: effectiveByDepartment,
    scannedPapers: Number(scannedRes.rows[0]?.total_scanned ?? 0),
    activitiesCreated: Number(activitiesRes.rows[0]?.total_activities ?? 0),
    assessments,
    hoursSaved: calculateHoursSaved(assessments),
    topTeachers: effectiveTopTeachers,
    listOfTeachers: effectiveListOfTeachers,
  };
}

function buildListOfTeachers(
  dbRows: any[],
  roster: RosterRow[],
): TeacherListItem[] {
  const items: Array<Omit<TeacherListItem, "number">> = [];
  const dbEmails = new Set<string>();

  for (const r of dbRows) {
    const email = String(r.email ?? "").trim().toLowerCase();
    if (email) dbEmails.add(email);
    const activities = Number(r.activities_created) || 0;
    const scans = Number(r.scanned_papers) || 0;
    const status: TeacherListStatus =
      activities > 0 || scans > 0 ? "active" : "inactive";
    const dept = r.department_name as string;
    const college = r.college_name as string;
    const collegeOrDept =
      dept && dept !== "No Department Assigned"
        ? dept
        : college || "No College Assigned";
    items.push({
      teacherName: r.teacher_name,
      collegeOrDept,
      status,
    });
  }

  for (const r of roster) {
    const email = (r.email ?? "").trim().toLowerCase();
    if (!email || dbEmails.has(email)) continue;
    const dept = (r.department ?? "").trim();
    const college = (r.college ?? "").trim();
    const collegeOrDept = dept || college || "";
    items.push({
      teacherName: r.name,
      collegeOrDept,
      status: "no_account",
    });
  }

  items.sort((a, b) =>
    a.teacherName.localeCompare(b.teacherName, undefined, {
      sensitivity: "base",
    }),
  );

  return items.map((it, i) => ({ number: i + 1, ...it }));
}
