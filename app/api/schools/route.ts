import { NextResponse } from "next/server";
import { sourcePool as pool } from "../_lib/db";
import { checkAuth } from "../_lib/auth";
import { toErrorResponse } from "../_lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denial = checkAuth(req);
  if (denial) return denial;

  try {
    const { rows } = await pool.query(
      `SELECT id, name FROM universities WHERE deleted IS NULL ORDER BY name`,
    );
    return NextResponse.json(rows);
  } catch (err) {
    return toErrorResponse(err);
  }
}
