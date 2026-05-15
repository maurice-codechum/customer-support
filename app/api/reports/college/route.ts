import { NextResponse } from "next/server";
import { getCollegeReportData } from "@/utils/reports/college";
import { checkAuth } from "../../_lib/auth";
import { badRequest, toErrorResponse } from "../../_lib/errors";
import { CollegeQuerySchema } from "../../_lib/validate";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denial = checkAuth(req);
  if (denial) return denial;

  try {
    const { searchParams } = new URL(req.url);
    const parsed = CollegeQuerySchema.safeParse({
      universityId: searchParams.get("universityId"),
      collegeId: searchParams.get("collegeId"),
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
    });
    if (!parsed.success) {
      return badRequest("validation_failed", parsed.error.issues);
    }
    const { universityId, collegeId, startDate, endDate } = parsed.data;

    const data = await getCollegeReportData({
      universityId,
      collegeId,
      startDate: startDate || "2000-01-01",
      endDate: endDate || "2100-01-01",
    });
    return NextResponse.json(data);
  } catch (err) {
    return toErrorResponse(err);
  }
}
