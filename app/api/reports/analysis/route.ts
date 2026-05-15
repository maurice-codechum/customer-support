import { NextResponse } from "next/server";
import { callGemini } from "@/app/api/_lib/gemini";
import { checkAuth } from "@/app/api/_lib/auth";
import { badRequest, toErrorResponse } from "@/app/api/_lib/errors";
import { AnalysisSchema, stripControl } from "@/app/api/_lib/validate";
import { abbreviateCollege, abbreviateDepartment } from "@/utils/reports/abbreviate";

type CollegeRow = {
  collegeName: string;
  rate: number | string;
  active?: number;
  total?: number;
};

type DepartmentRow = {
  departmentName: string;
  rate: number | string;
  active?: number;
  total?: number;
};

function pct(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0%";
  return `${(Math.round(v * 10) / 10).toFixed(1)}%`;
}

function formatRows(rows: CollegeRow[]): string {
  return [...rows]
    .sort((a, b) => Number(b.rate) - Number(a.rate))
    .map((r) => `- ${stripControl(abbreviateCollege(r.collegeName))}: ${pct(r.rate)}`)
    .join("\n");
}

function formatDepartmentRows(rows: DepartmentRow[]): string {
  return [...rows]
    .sort((a, b) => Number(b.rate) - Number(a.rate))
    .map(
      (r) =>
        `- ${stripControl(abbreviateDepartment(r.departmentName))}: ${pct(r.rate)}`,
    )
    .join("\n");
}

const STYLE = `Style guide:
- Plain prose, factual, neutral. No markdown, no bullets, no headers.
- 1-2 sentences total. No paragraphs, no extra commentary.
- List every entry with its percentage in descending order. Group the lowest entries in a single tail clause.
- Use names exactly as given.
- Quote percentages with one decimal (e.g., "47.4%"); a clean whole number may be written without the decimal (e.g., "50%").
- Mirror this tone exactly:
  "ME leads with 56.3% usage, followed by Architecture at 54.1% and CpE at 50%. Adoption is lower in IE (36.4%), EM (28.6%), ChE (25%), EE (15.4%), ECE (12.5%), DEMPC (9.1%), and CE (2.1%)."
  "Figure 1.5 shows GradeChum usage led by Accountancy at 66.7%, followed by BA/OAD/PA at 60%, with DHTM at 10%."
- Do not invent numbers. Do not editorialize. Do not characterize adoption (no "strong/moderate/low", no "leaders/mid-tier/laggards" framing in the output).`;

type Body = {
  kind: "total" | "byCollege" | "byDepartment";
  schoolName?: string;
  collegeName?: string;
  figureLabel?: string;
  utilization?: { active: number; total: number; rate: number };
  byCollege?: CollegeRow[];
  byDepartment?: DepartmentRow[];
};

function totalPrompt(b: Body): string {
  const u = b.utilization ?? { active: 0, total: 0, rate: 0 };
  const school = b.schoolName ? `${stripControl(b.schoolName)} ` : "";
  const fig = b.figureLabel ?? "1.1";

  if (b.collegeName) {
    const college = stripControl(b.collegeName);
    return `Write a one-sentence analysis for the "Total Utilization Percentage" section of a ${school}GradeChum adoption report, focused on ${college}.

College utilization: ${u.active} of ${u.total} teachers at ${college} are active (${pct(u.rate)}).

Style guide:
- Plain prose, factual, neutral. No markdown, no bullets, no headers.
- EXACTLY ONE sentence.
- Refer to the chart as "Figure ${fig}" and state the active-of-total count at ${college} plus the percentage. Example: "Figure ${fig} shows ${u.active} of ${u.total} teachers at ${college} active on GradeChum (${pct(u.rate)})."
- Do NOT characterize the level (no "low/moderate/strong"). Do NOT mention other colleges or departments.
- Quote the percentage with one decimal.

Output the analysis text only.`;
  }

  return `Write a one-sentence analysis for the "Total Utilization Percentage" section of a ${school}GradeChum adoption report.

School-wide utilization: ${u.active} of ${u.total} teachers active (${pct(u.rate)}).

Style guide:
- Plain prose, factual, neutral. No markdown, no bullets, no headers.
- EXACTLY ONE sentence.
- Refer to the chart as "Figure ${fig}" and state the active-of-total count plus the percentage. Example: "Figure ${fig} shows ${u.active} of ${u.total} teachers active on GradeChum (${pct(u.rate)})."
- Do NOT characterize the level (no "low/moderate/strong"). Do NOT mention individual colleges or per-college breakdowns.
- Quote the percentage with one decimal.

Output the analysis text only.`;
}

function byCollegePrompt(b: Body): string {
  const rows = b.byCollege ?? [];
  const school = b.schoolName ? `${stripControl(b.schoolName)} ` : "";
  const fig = b.figureLabel ?? "1.2";
  return `Write an analysis paragraph for the "Utilization by College" section of a ${school}GradeChum adoption report.

Per-college rates:
${formatRows(rows)}

${STYLE}
- Refer to the chart as "Figure ${fig}" (e.g., "Figure ${fig} shows..."). You may also open with the leader directly (e.g., "ME leads with 56.3% usage, ...").
- List every college with its percentage in descending order. Group the lowest entries in a single tail clause.

Output the analysis text only.`;
}

function byDepartmentPrompt(b: Body): string {
  const rows = b.byDepartment ?? [];
  const school = b.schoolName ? `${stripControl(b.schoolName)} ` : "";
  const college = b.collegeName ? stripControl(b.collegeName) : "the college";
  const fig = b.figureLabel ?? "1.3";
  return `Write a 1-2 sentence analysis for the "Utilization by Department" section of a ${school}GradeChum adoption report, focused on ${college}.

Per-department rates for ${college}:
${formatDepartmentRows(rows)}

${STYLE}
- Refer to the chart as "Figure ${fig}" (e.g., "Figure ${fig} shows..."). You may also open with the leader directly.
- List every department within ${college} with its percentage in descending order. Group the lowest entries in a single tail clause.
- Use department names exactly as given.

Output the analysis text only.`;
}

export async function POST(req: Request) {
  const denial = checkAuth(req);
  if (denial) return denial;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest("invalid json");
  }
  const parsed = AnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    return badRequest("validation_failed", parsed.error.issues);
  }
  const body = parsed.data as Body;

  try {
    const prompt =
      body.kind === "total"
        ? totalPrompt(body)
        : body.kind === "byCollege"
          ? byCollegePrompt(body)
          : byDepartmentPrompt(body);
    const result = await callGemini<string>({ prompt, temperature: 0.4 });
    if (!result.ok) {
      return NextResponse.json({ text: "", warning: result.reason });
    }
    return NextResponse.json({ text: result.data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
