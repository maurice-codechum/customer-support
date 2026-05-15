import { NextResponse } from "next/server";
import { reportsPool as pool, sourcePool } from "../../_lib/db";
import { checkAuth } from "../../_lib/auth";
import { badRequest, notFound, toErrorResponse } from "../../_lib/errors";
import { dateToString, timestampToIso } from "../../_lib/date";
import { UpdateReportSchema } from "../../_lib/validate";

export const dynamic = "force-dynamic";

type ReportRow = {
  id: string | number;
  university_id: string | number;
  college_id: string | number | null;
  department_id: string | number | null;
  date_from: Date | string;
  date_to: Date | string;
  template_name: string;
  recommendations: string | null;
  created_at: Date | string;
};

type HighlightRow = {
  id: string | number;
  position: string | number;
  title: string;
  description: string;
  short_description: string;
  has_image: boolean;
  image_mime: string | null;
};

type FeedbackRow = {
  id: string | number;
  position: string | number;
  teacher_name: string;
  department_name: string;
  feedback: string;
};

type RosterRowDb = {
  position: string | number;
  name: string;
  email: string | null;
  college: string | null;
  department: string | null;
  course_code: string | null;
  section: string | null;
};

function decodeBase64(s: string): Buffer {
  return Buffer.from(s, "base64");
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denial = checkAuth(req);
  if (denial) return denial;

  try {
    const { id } = await params;
    const reportRes = await pool.query<ReportRow>(
      `SELECT id, university_id, college_id, department_id,
              date_from, date_to, template_name, recommendations, created_at
       FROM reports
       WHERE id = $1`,
      [id],
    );
    if (reportRes.rowCount === 0) return notFound();
    const r = reportRes.rows[0];

    const [nameRes, hlRes, fbRes, rosterRes] = await Promise.all([
      sourcePool.query<{ name: string }>(
        `SELECT name FROM universities WHERE id = $1`,
        [r.university_id],
      ),
      pool.query<HighlightRow>(
        `SELECT id, position, title, description, short_description,
                (image_blob IS NOT NULL) AS has_image, image_mime
         FROM report_product_highlights
         WHERE report_id = $1
         ORDER BY position`,
        [id],
      ),
      pool.query<FeedbackRow>(
        `SELECT id, position, teacher_name, department_name, feedback
         FROM report_teacher_feedbacks
         WHERE report_id = $1
         ORDER BY position`,
        [id],
      ),
      pool.query<RosterRowDb>(
        `SELECT position, name, email, college, department, course_code, section
         FROM report_rosters
         WHERE report_id = $1
         ORDER BY position`,
        [id],
      ),
    ]);

    const universityName = nameRes.rows[0]?.name ?? null;

    return NextResponse.json({
      id: Number(r.id),
      universityId: Number(r.university_id),
      universityName,
      collegeId: r.college_id === null ? null : Number(r.college_id),
      departmentId: r.department_id === null ? null : Number(r.department_id),
      dateFrom: dateToString(r.date_from),
      dateTo: dateToString(r.date_to),
      templateName: r.template_name,
      recommendations: r.recommendations ?? null,
      createdAt: timestampToIso(r.created_at),
      productHighlights: hlRes.rows.map((row) => ({
        id: Number(row.id),
        position: Number(row.position),
        title: row.title,
        description: row.description,
        shortDescription: row.short_description,
        hasImage: !!row.has_image,
        imageMime: row.image_mime ?? null,
      })),
      teacherFeedbacks: fbRes.rows.map((row) => ({
        id: Number(row.id),
        position: Number(row.position),
        teacherName: row.teacher_name,
        departmentName: row.department_name,
        feedback: row.feedback,
      })),
      roster: rosterRes.rows.map((row) => ({
        name: row.name,
        email: row.email ?? null,
        college: row.college ?? null,
        department: row.department ?? null,
        courseCode: row.course_code ?? null,
        section: row.section ?? null,
      })),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denial = checkAuth(req);
  if (denial) return denial;

  const { id } = await params;
  const reportId = Number(id);
  if (!Number.isFinite(reportId)) return badRequest("invalid_id");

  try {
    const res = await pool.query(`DELETE FROM reports WHERE id = $1`, [
      reportId,
    ]);
    if (res.rowCount === 0) return notFound();
    return NextResponse.json({ id: reportId });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denial = checkAuth(req);
  if (denial) return denial;

  const { id } = await params;
  const reportId = Number(id);
  if (!Number.isFinite(reportId)) return badRequest("invalid_id");

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest("invalid JSON");
  }

  const parsed = UpdateReportSchema.safeParse(raw);
  if (!parsed.success) {
    return badRequest("validation_failed", parsed.error.issues);
  }
  const body = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const exists = await client.query(
      `SELECT id FROM reports WHERE id = $1`,
      [reportId],
    );
    if (exists.rowCount === 0) {
      await client.query("ROLLBACK");
      return notFound();
    }

    if (body.template) {
      const templateBuf = decodeBase64(body.template.dataBase64);
      await client.query(
        `UPDATE reports
           SET university_id = $1, college_id = $2, department_id = $3,
               date_from = $4, date_to = $5, recommendations = $6,
               template_name = $7, template_blob = $8
         WHERE id = $9`,
        [
          body.universityId,
          body.collegeId ?? null,
          body.departmentId ?? null,
          body.dateFrom,
          body.dateTo,
          body.recommendations ?? null,
          body.template.name,
          templateBuf,
          reportId,
        ],
      );
    } else {
      await client.query(
        `UPDATE reports
           SET university_id = $1, college_id = $2, department_id = $3,
               date_from = $4, date_to = $5, recommendations = $6
         WHERE id = $7`,
        [
          body.universityId,
          body.collegeId ?? null,
          body.departmentId ?? null,
          body.dateFrom,
          body.dateTo,
          body.recommendations ?? null,
          reportId,
        ],
      );
    }

    const carried: Array<{ buf: Buffer | null; mime: string | null }> = [];
    for (const h of body.productHighlights) {
      if (h.image?.dataBase64) {
        carried.push({
          buf: decodeBase64(h.image.dataBase64),
          mime: h.image.mime ?? null,
        });
      } else if (h.keepImage && h.existingId) {
        const r = await client.query<{
          image_blob: Buffer | null;
          image_mime: string | null;
        }>(
          `SELECT image_blob, image_mime
             FROM report_product_highlights
            WHERE id = $1 AND report_id = $2`,
          [h.existingId, reportId],
        );
        const row = r.rows[0];
        carried.push({
          buf: row?.image_blob ?? null,
          mime: row?.image_mime ?? null,
        });
      } else {
        carried.push({ buf: null, mime: null });
      }
    }

    await client.query(
      `DELETE FROM report_product_highlights WHERE report_id = $1`,
      [reportId],
    );
    for (let i = 0; i < body.productHighlights.length; i++) {
      const h = body.productHighlights[i];
      const c = carried[i];
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
          c.buf,
          c.mime,
        ],
      );
    }

    await client.query(
      `DELETE FROM report_teacher_feedbacks WHERE report_id = $1`,
      [reportId],
    );
    for (let i = 0; i < body.teacherFeedbacks.length; i++) {
      const f = body.teacherFeedbacks[i];
      await client.query(
        `INSERT INTO report_teacher_feedbacks
           (report_id, position, teacher_name, department_name, feedback)
         VALUES ($1,$2,$3,$4,$5)`,
        [reportId, i, f.teacherName, f.departmentName, f.feedback],
      );
    }

    if (Array.isArray(body.roster)) {
      await client.query(`DELETE FROM report_rosters WHERE report_id = $1`, [
        reportId,
      ]);
      const roster = body.roster;
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
