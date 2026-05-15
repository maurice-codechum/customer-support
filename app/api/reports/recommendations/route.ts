import { NextResponse } from "next/server";
import { callGemini } from "@/app/api/_lib/gemini";
import { checkAuth } from "@/app/api/_lib/auth";
import { badRequest, toErrorResponse } from "@/app/api/_lib/errors";
import { RecommendationsSchema, stripControl } from "@/app/api/_lib/validate";
import { abbreviateCollege } from "@/utils/reports/abbreviate";

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

type Body = {
  schoolName?: string;
  utilization?: { active: number; total: number; rate: number };
  byCollege?: CollegeRow[];
  userRecommendations?: string | null;
  scope?: "university" | "college";
  collegeName?: string;
  byDepartment?: DepartmentRow[];
};

type RecommendationsResult = {
  recommendations: Array<{ action: string; outcome: string }>;
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

function formatDeptRows(rows: DepartmentRow[]): string {
  return [...rows]
    .sort((a, b) => Number(b.rate) - Number(a.rate))
    .map((r) => `- ${stripControl(r.departmentName)}: ${pct(r.rate)}`)
    .join("\n");
}

function buildPrompt(b: Body): string {
  const u = b.utilization ?? { active: 0, total: 0, rate: 0 };
  const school = b.schoolName ? stripControl(b.schoolName) : "the university";
  const userInput = stripControl((b.userRecommendations ?? "").trim());
  const userBlock = userInput
    ? `\nUser-provided priorities (use as steering context, paraphrase, do not quote verbatim):\n${userInput}\n`
    : "";

  if (b.scope === "college") {
    const college = b.collegeName ? stripControl(b.collegeName) : "the college";
    const deptRows = b.byDepartment ?? [];
    const deptBlock = deptRows.length
      ? `\nPer-department rates:\n${formatDeptRows(deptRows)}\n`
      : "";

    return `Generate exactly 3 concrete recommendations for the Dean of ${college} at ${school} to increase GradeChum adoption within the college.

College-wide utilization: ${u.active} of ${u.total} teachers active (${pct(u.rate)}).
${deptBlock}${userBlock}
Rules:
- Return exactly 3 recommendations.
- Each recommendation has two fields: "action" (what the Dean should do) and "outcome" (the expected result).
- Each field must be exactly ONE short sentence (max ~12 words), factual and neutral.
- Actions should target Dean-led initiatives within the college (department meetings, faculty training, recognizing top users, identifying department champions, encouraging adoption in low-uptake departments, etc.).
- Outcomes should describe a plausible adoption or culture effect within the college.
- Do not invent specific numbers, names, or dates.
- Do not mention chart figures or percentages.

Examples of tone:
- action: "Highlight GradeChum at department meetings to encourage faculty use."
  outcome: "Signals Dean backing and broadens visibility."
- action: "Support faculty champions in low-adoption departments."
  outcome: "Peer-led momentum lowers barriers for hesitant teachers."`;
  }

  const rows = b.byCollege ?? [];
  return `Generate exactly 3 concrete recommendations for increasing GradeChum adoption at ${school}.

School-wide utilization: ${u.active} of ${u.total} teachers active (${pct(u.rate)}).

Per-college rates:
${formatRows(rows)}
${userBlock}
Rules:
- Return exactly 3 recommendations.
- Each recommendation has two fields: "action" (what the school should do) and "outcome" (the expected result).
- Each field must be exactly ONE short sentence (max ~12 words), factual and neutral.
- Actions should target leadership-led initiatives (memos, assemblies, councils, training, showcasing peer success, departmental champions, etc.).
- Outcomes should describe a plausible adoption or culture effect.
- Do not invent specific numbers, names, or dates.
- Do not mention chart figures or percentages.

Examples of tone:
- action: "Issue campus-wide memo encouraging GradeChum use in classes."
  outcome: "Raises awareness and adoption across colleges."
- action: "Mention GradeChum during assemblies or academic councils."
  outcome: "Reinforces importance and institutional backing."
- action: "Share peer success stories using GradeChum."
  outcome: "Builds trust and motivates hesitant faculty."`;
}

const SCHEMA = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          action: { type: "string" },
          outcome: { type: "string" },
        },
        required: ["action", "outcome"],
      },
    },
  },
  required: ["recommendations"],
};

export async function POST(req: Request) {
  const denial = checkAuth(req);
  if (denial) return denial;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest("invalid json");
  }
  const parsed = RecommendationsSchema.safeParse(raw);
  if (!parsed.success) {
    return badRequest("validation_failed", parsed.error.issues);
  }
  const body = parsed.data as Body;

  try {
    const result = await callGemini<RecommendationsResult>({
      prompt: buildPrompt(body),
      schema: SCHEMA,
      temperature: 0.4,
    });
    if (!result.ok) {
      return NextResponse.json({ recommendations: [], warning: result.reason });
    }
    return NextResponse.json({
      recommendations: result.data?.recommendations ?? [],
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
