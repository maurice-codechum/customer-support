import { sourcePool as pool } from "@/app/api/_lib/db";

export type CollegeReportData = {
  universityId: string;
  collegeId: number;
  collegeName: string;
  dateRange: { from: string; to: string };
  utilization: { total: number; active: number; rate: number };
  byDepartment: Array<{
    departmentId: number | null;
    departmentName: string;
    total: number;
    active: number;
    rate: number;
  }>;
  scannedPapers: number;
  activitiesCreated: number;
  assessments: Array<{ itemType: string; totalTasks: number }>;
  hoursSaved: number;
  topTeachers: Array<{
    teacherId: number;
    teacherName: string;
    departmentName: string;
    activitiesCreated: number;
    scannedPapers: number;
  }>;
};

const UTILIZATION_SQL = `
  WITH teacher_scans AS (
    SELECT s.teacher_id, COUNT(rp.id) as scanned_papers
    FROM result_pages rp
    JOIN tasks t ON rp.task_id = t.id
    JOIN task_sections ts ON t.id = ts.task_id
    JOIN sections s ON ts.section_id = s.id
    WHERE rp.deleted IS NULL AND t.deleted IS NULL AND s.deleted IS NULL
      AND rp.datetime_created >= $1 AND rp.datetime_created <= $2
    GROUP BY s.teacher_id
  ),
  teacher_info AS (
    SELECT u.id as teacher_id, u.university_id,
      COALESCE(u.campus_id, 0) as campus_id, COALESCE(camp.name, 'No Campus Assigned') as campus_name,
      cd.college_id, coll.name as college_name,
      u.campus_department_id, COALESCE(cd.name, d.name, 'No Department Assigned') as department_name,
      CASE WHEN COALESCE(ts.scanned_papers, 0) > 5 THEN 1 ELSE 0 END as is_active
    FROM users u
    LEFT JOIN campuses camp ON u.campus_id = camp.id
    JOIN campus_departments cd ON u.campus_department_id = cd.id
    LEFT JOIN departments d ON cd.department_id = d.id
    LEFT JOIN campus_colleges coll ON cd.college_id = coll.id
    LEFT JOIN teacher_scans ts ON u.id = ts.teacher_id
    WHERE u.user_type = 'T' AND u.deleted IS NULL AND u.university_id = $3
      AND cd.college_id = $4
  ),
  college_level AS (
    SELECT 'College' as level, COALESCE(college_name, 'No College Assigned') as name,
      COUNT(teacher_id) as total_teachers, SUM(is_active) as active_teachers,
      ROUND(SUM(is_active)::numeric / NULLIF(COUNT(teacher_id), 0) * 100, 2) as utilization_rate,
      college_id, NULL::bigint as department_id, 1 as sort_order
    FROM teacher_info GROUP BY college_id, college_name
  ),
  department_level AS (
    SELECT 'Department' as level, department_name as name,
      COUNT(teacher_id) as total_teachers, SUM(is_active) as active_teachers,
      ROUND(SUM(is_active)::numeric / NULLIF(COUNT(teacher_id), 0) * 100, 2) as utilization_rate,
      college_id, campus_department_id as department_id, 2 as sort_order
    FROM teacher_info GROUP BY college_id, campus_department_id, department_name
  )
  SELECT level, name, total_teachers, active_teachers,
    COALESCE(utilization_rate, 0) as utilization_rate, college_id, department_id
  FROM (
    SELECT * FROM college_level
    UNION ALL SELECT * FROM department_level
  ) combined
  ORDER BY sort_order, name
`;

const SCANNED_PAPERS_SQL = `
  SELECT COALESCE(SUM(scanned)::bigint, 0) as total_scanned
  FROM (
    SELECT COUNT(rp.id) as scanned
    FROM result_pages rp
    JOIN tasks t ON rp.task_id = t.id
    JOIN task_sections ts ON t.id = ts.task_id
    JOIN sections s ON ts.section_id = s.id
    JOIN users u ON s.teacher_id = u.id
    JOIN campus_departments cd ON u.campus_department_id = cd.id
    WHERE rp.deleted IS NULL AND t.deleted IS NULL AND s.deleted IS NULL
      AND u.deleted IS NULL AND u.user_type = 'T' AND u.university_id = $3
      AND cd.college_id = $4
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
  JOIN campus_departments cd ON u.campus_department_id = cd.id
  WHERE t.deleted IS NULL AND s.deleted IS NULL AND u.deleted IS NULL
    AND u.user_type = 'T' AND u.university_id = $3
    AND cd.college_id = $4
    AND t.datetime_created >= $1 AND t.datetime_created <= $2
`;

const ASSESSMENTS_SQL = `
  WITH target_college AS (
    SELECT cc.id as college_id, cc.name as college_name
    FROM universities univ
    JOIN campuses camp ON camp.university_id = univ.id
    JOIN campus_colleges cc ON cc.campus_id = camp.id
    WHERE univ.deleted IS NULL AND camp.deleted IS NULL AND cc.deleted IS NULL
      AND univ.id::text = $3 AND cc.id = $4
    LIMIT 1
  ),
  valid_tasks AS (
    SELECT t.id as task_id, s.teacher_id
    FROM tasks t
    JOIN task_sections ts ON t.id = ts.task_id
    JOIN sections s ON ts.section_id = s.id
    JOIN result_pages rp ON rp.task_id = t.id
    WHERE t.deleted IS NULL AND s.deleted IS NULL AND rp.deleted IS NULL
      AND rp.datetime_created >= $1 AND rp.datetime_created <= $2
      AND EXISTS (SELECT 1 FROM results r WHERE r.task_id = t.id AND r.deleted IS NULL AND r.status = 1)
    GROUP BY t.id, s.teacher_id HAVING COUNT(DISTINCT rp.id) > 5
  ),
  task_item_types AS (
    SELECT DISTINCT task_id, item_type FROM items
    WHERE deleted IS NULL AND item_type IN ('multiple_choice', 'identification', 'enumeration', 'essay', 'problem_solving', 'code_on_paper', 'visual')
  ),
  college_tasks AS (
    SELECT tit.item_type, vt.task_id
    FROM valid_tasks vt
    JOIN task_item_types tit ON vt.task_id = tit.task_id
    JOIN users teacher ON vt.teacher_id = teacher.id
    JOIN campus_departments cd ON teacher.campus_department_id = cd.id
    WHERE teacher.deleted IS NULL AND teacher.user_type = 'T'
      AND cd.college_id = $4
  ),
  college_unique_tasks AS (
    SELECT vt.task_id
    FROM valid_tasks vt
    JOIN users teacher ON vt.teacher_id = teacher.id
    JOIN campus_departments cd ON teacher.campus_department_id = cd.id
    WHERE teacher.deleted IS NULL AND teacher.user_type = 'T'
      AND cd.college_id = $4
  )
  SELECT ct.item_type, COUNT(DISTINCT ct.task_id) as total_tasks
  FROM target_college tc
  LEFT JOIN college_tasks ct ON TRUE
  GROUP BY ct.item_type

  UNION ALL

  SELECT 'total_unique_tasks' as item_type, COUNT(DISTINCT cut.task_id) as total_tasks
  FROM target_college tc
  LEFT JOIN college_unique_tasks cut ON TRUE
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
    COALESCE(cd.name, d.name, 'No Department Assigned') as department_name,
    COALESCE(tt.activities_created, 0) as activities_created,
    COALESCE(ts.scanned_papers, 0) as scanned_papers
  FROM users u
  JOIN campus_departments cd ON u.campus_department_id = cd.id
  LEFT JOIN departments d ON cd.department_id = d.id
  LEFT JOIN teacher_tasks tt ON u.id = tt.teacher_id
  LEFT JOIN teacher_scans ts ON u.id = ts.teacher_id
  WHERE u.user_type = 'T' AND u.deleted IS NULL AND u.university_id::text = $3
    AND cd.college_id = $4
    AND (tt.activities_created > 0 OR ts.scanned_papers > 0)
  ORDER BY activities_created DESC, scanned_papers DESC
  LIMIT 3
`;

const COLLEGE_NAME_SQL = `SELECT name FROM campus_colleges WHERE id = $1 LIMIT 1`;

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
  assessments: CollegeReportData["assessments"],
): number {
  let totalMinutes = 0;
  for (const r of assessments) {
    const m = MINUTES_PER_TASK[r.itemType];
    if (!m) continue;
    totalMinutes += (Number(r.totalTasks) || 0) * m;
  }
  return totalMinutes / 60;
}

export async function getCollegeReportData(params: {
  universityId: string;
  collegeId: number;
  startDate: string;
  endDate: string;
}): Promise<CollegeReportData> {
  const { universityId, collegeId } = params;
  const from = params.startDate;
  const to =
    params.endDate.length === 10
      ? `${params.endDate} 23:59:59`
      : params.endDate;

  const args = [from, to, universityId, collegeId];

  const [utilRes, scannedRes, activitiesRes, assessmentsRes, topRes, nameRes] =
    await Promise.all([
      pool.query(UTILIZATION_SQL, args),
      pool.query(SCANNED_PAPERS_SQL, args),
      pool.query(ACTIVITIES_CREATED_SQL, args),
      pool.query(ASSESSMENTS_SQL, args),
      pool.query(TOP_TEACHERS_SQL, args),
      pool.query(COLLEGE_NAME_SQL, [collegeId]),
    ]);

  const collegeRow = utilRes.rows.find((r: any) => r.level === "College");
  const utilization = {
    total: Number(collegeRow?.total_teachers ?? 0),
    active: Number(collegeRow?.active_teachers ?? 0),
    rate: Number(collegeRow?.utilization_rate ?? 0),
  };

  const byDepartment = utilRes.rows
    .filter((r: any) => r.level === "Department")
    .map((r: any) => ({
      departmentId: r.department_id === null ? null : Number(r.department_id),
      departmentName: r.name,
      total: Number(r.total_teachers),
      active: Number(r.active_teachers),
      rate: Number(r.utilization_rate),
    }));

  const assessments = assessmentsRes.rows
    .filter((r: any) => r.item_type !== null)
    .map((r: any) => ({
      itemType: r.item_type,
      totalTasks: Number(r.total_tasks ?? 0),
    }));

  const topTeachers = topRes.rows.map((r: any) => ({
    teacherId: Number(r.teacher_id),
    teacherName: r.teacher_name,
    departmentName: r.department_name,
    activitiesCreated: Number(r.activities_created),
    scannedPapers: Number(r.scanned_papers),
  }));

  const collegeName =
    collegeRow?.name ?? nameRes.rows[0]?.name ?? "";

  return {
    universityId,
    collegeId,
    collegeName,
    dateRange: { from, to },
    utilization,
    byDepartment,
    scannedPapers: Number(scannedRes.rows[0]?.total_scanned ?? 0),
    activitiesCreated: Number(activitiesRes.rows[0]?.total_activities ?? 0),
    assessments,
    hoursSaved: calculateHoursSaved(assessments),
    topTeachers,
  };
}
