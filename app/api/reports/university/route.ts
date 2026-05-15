import { NextResponse } from "next/server";
import { getUniversityReportData } from "@/utils/reports/university";
import { checkAuth } from "../../_lib/auth";
import { badRequest, toErrorResponse } from "../../_lib/errors";
import {
  UniversityBodySchema,
  UniversityQuerySchema,
} from "../../_lib/validate";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denial = checkAuth(req);
  if (denial) return denial;

  try {
    const { searchParams } = new URL(req.url);
    const parsed = UniversityQuerySchema.safeParse({
      universityId: searchParams.get("universityId"),
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
    });
    if (!parsed.success) {
      return badRequest("validation_failed", parsed.error.issues);
    }
    const { universityId, startDate, endDate } = parsed.data;

    const data = await getUniversityReportData({
      universityId,
      startDate: startDate || "2000-01-01",
      endDate: endDate || "2100-01-01",
    });
    return NextResponse.json(data);
  } catch (err) {
    return toErrorResponse(err);
  }
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
  const parsed = UniversityBodySchema.safeParse(raw);
  if (!parsed.success) {
    return badRequest("validation_failed", parsed.error.issues);
  }
  const body = parsed.data;

  try {
    const roster = (body.roster ?? []).map((r) => ({
      name: r.name,
      email: r.email ?? null,
      college: r.college ?? null,
      department: r.department ?? null,
      courseCode: r.courseCode ?? null,
      section: r.section ?? null,
    }));
    const data = await getUniversityReportData({
      universityId: body.universityId,
      startDate: body.startDate || "2000-01-01",
      endDate: body.endDate || "2100-01-01",
      roster,
    });
    return NextResponse.json(data);
  } catch (err) {
    return toErrorResponse(err);
  }
}
