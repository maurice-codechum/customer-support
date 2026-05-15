import { NextResponse } from "next/server";
import { reportsPool as pool, sourcePool } from "../_lib/db";
import { checkAuth } from "../_lib/auth";
import { badRequest, toErrorResponse } from "../_lib/errors";
import { dateToString, timestampToIso } from "../_lib/date";
import { CreateReportSchema } from "../_lib/validate";

export const dynamic = "force-dynamic";

type ReportRow = {
  id: string | number;
  university_id: string | number;
  college_id: string | number | null;
  department_id: string | number | null;
  date_from: Date | string;
  date_to: Date | string;
  template_name: string;
  created_at: Date | string;
};

type NameRow = { id: string | number; name: string };

export async function GET(req: Request) {
  const denial = checkAuth(req);
  if (denial) return denial;

  try {
    const { rows } = await pool.query<ReportRow>(
      `SELECT id, university_id, college_id, department_id,
              date_from, date_to, template_name, created_at
       FROM reports
       ORDER BY created_at DESC`,
    );

    const universityIds = Array.from(
      new Set(rows.map((r) => Number(r.university_id))),
    );
    const collegeIds = Array.from(
      new Set(
        rows
          .filter((r) => r.college_id !== null)
          .map((r) => Number(r.college_id)),
      ),
    );
    const departmentIds = Array.from(
      new Set(
        rows
          .filter((r) => r.department_id !== null)
          .map((r) => Number(r.department_id)),
      ),
    );

    const [universityRes, collegeRes, departmentRes] = await Promise.all([
      universityIds.length === 0
        ? Promise.resolve({ rows: [] as NameRow[] })
        : sourcePool.query<NameRow>(
            `SELECT id, name FROM universities WHERE id = ANY($1::bigint[])`,
            [universityIds],
          ),
      collegeIds.length === 0
        ? Promise.resolve({ rows: [] as NameRow[] })
        : sourcePool.query<NameRow>(
            `SELECT id, name FROM campus_colleges WHERE id = ANY($1::bigint[])`,
            [collegeIds],
          ),
      departmentIds.length === 0
        ? Promise.resolve({ rows: [] as NameRow[] })
        : sourcePool.query<NameRow>(
            `SELECT cd.id, COALESCE(cd.name, d.name) AS name
             FROM campus_departments cd
             LEFT JOIN departments d ON cd.department_id = d.id
             WHERE cd.id = ANY($1::bigint[])`,
            [departmentIds],
          ),
    ]);

    const nameMap = new Map<number, string>();
    for (const n of universityRes.rows) nameMap.set(Number(n.id), n.name);
    const collegeMap = new Map<number, string>();
    for (const n of collegeRes.rows) collegeMap.set(Number(n.id), n.name);
    const departmentMap = new Map<number, string>();
    for (const n of departmentRes.rows) departmentMap.set(Number(n.id), n.name);

    const items = rows.map((r) => ({
      id: Number(r.id),
      universityId: Number(r.university_id),
      universityName: nameMap.get(Number(r.university_id)) ?? null,
      collegeId: r.college_id === null ? null : Number(r.college_id),
      collegeName:
        r.college_id === null
          ? null
          : (collegeMap.get(Number(r.college_id)) ?? null),
      departmentId: r.department_id === null ? null : Number(r.department_id),
      departmentName:
        r.department_id === null
          ? null
          : (departmentMap.get(Number(r.department_id)) ?? null),
      dateFrom: dateToString(r.date_from),
      dateTo: dateToString(r.date_to),
      templateName: r.template_name,
      createdAt: timestampToIso(r.created_at),
    }));
    return NextResponse.json(items);
  } catch (err) {
    return toErrorResponse(err);
  }
}

function decodeBase64(s: string): Buffer {
  return Buffer.from(s, "base64");
}

export async function POST(req: Request) {
  const denial = checkAuth(req);
  if (denial) return denial;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest("invalid JSON");
  }

  const parsed = CreateReportSchema.safeParse(raw);
  if (!parsed.success) {
    return badRequest("validation_failed", parsed.error.issues);
  }
  const body = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const templateBuf = decodeBase64(body.template.dataBase64);
    const insertReport = await client.query<{ id: string | number }>(
      `INSERT INTO reports
         (university_id, college_id, department_id, date_from, date_to,
          template_name, template_blob, recommendations)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        body.universityId,
        body.collegeId ?? null,
        body.departmentId ?? null,
        body.dateFrom,
        body.dateTo,
        body.template.name,
        templateBuf,
        body.recommendations ?? null,
      ],
    );
    const reportId = Number(insertReport.rows[0].id);

    for (let i = 0; i < body.productHighlights.length; i++) {
      const h = body.productHighlights[i];
      const imgBuf = h.image?.dataBase64
        ? decodeBase64(h.image.dataBase64)
        : null;
      await client.query(
        `INSERT INTO report_product_highlights
           (report_id, position, title, description, short_description,
            image_blob, image_mime)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          reportId,
          i,
          h.title,
          h.description,
          h.shortDescription,
          imgBuf,
          h.image?.mime ?? null,
        ],
      );
    }

    for (let i = 0; i < body.teacherFeedbacks.length; i++) {
      const f = body.teacherFeedbacks[i];
      await client.query(
        `INSERT INTO report_teacher_feedbacks
           (report_id, position, teacher_name, department_name, feedback)
         VALUES ($1,$2,$3,$4,$5)`,
        [reportId, i, f.teacherName, f.departmentName, f.feedback],
      );
    }

    const roster = body.roster ?? [];
    for (let i = 0; i < roster.length; i++) {
      const r = roster[i];
      await client.query(
        `INSERT INTO report_rosters
           (report_id, position, name, email, college, department, course_code, section)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          reportId,
          i,
          r.name,
          r.email ?? null,
          r.college ?? null,
          r.department ?? null,
          r.courseCode ?? null,
          r.section ?? null,
        ],
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ id: reportId });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return toErrorResponse(err);
  } finally {
    client.release();
  }
}
