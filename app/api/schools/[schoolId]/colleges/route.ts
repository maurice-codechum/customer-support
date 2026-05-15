import { NextResponse } from "next/server";
import { sourcePool as pool } from "../../../_lib/db";
import { checkAuth } from "../../../_lib/auth";
import { toErrorResponse } from "../../../_lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  const denial = checkAuth(req);
  if (denial) return denial;

  try {
    const { schoolId } = await params;
    const { rows } = await pool.query(
      `SELECT cc.id, cc.name
       FROM campus_colleges cc
       JOIN campuses camp ON cc.campus_id = camp.id
       WHERE cc.deleted IS NULL AND camp.deleted IS NULL
         AND camp.university_id = $1
       ORDER BY cc.name`,
      [schoolId],
    );
    return NextResponse.json(rows);
  } catch (err) {
    return toErrorResponse(err);
  }
}
