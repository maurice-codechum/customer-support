import { NextResponse } from "next/server";
import { sourcePool as pool } from "../../../../../_lib/db";
import { checkAuth } from "../../../../../_lib/auth";
import { toErrorResponse } from "../../../../../_lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ schoolId: string; collegeId: string }> },
) {
  const denial = checkAuth(req);
  if (denial) return denial;

  try {
    const { schoolId, collegeId } = await params;
    const { rows } = await pool.query(
      `SELECT cd.id,
              COALESCE(cd.name, d.name) AS name
       FROM campus_departments cd
       LEFT JOIN departments d ON cd.department_id = d.id
       JOIN campuses camp ON cd.campus_id = camp.id
       WHERE cd.deleted IS NULL AND camp.deleted IS NULL
         AND camp.university_id = $1
         AND cd.college_id = $2
       ORDER BY name`,
      [schoolId, collegeId],
    );
    return NextResponse.json(rows);
  } catch (err) {
    return toErrorResponse(err);
  }
}
