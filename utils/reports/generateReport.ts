import { apiFetch } from "@/utils/apiFetch";
import { fillUniversityTemplate } from "./fillUniversityTemplate";
import { fillCollegeTemplate } from "./fillCollegeTemplate";
import {
  collegeOverallUtilizationPieOption,
  collegeUtilizationBarOption,
  departmentUtilizationBarOption,
  hoursSavedBarOption,
  renderChartToPng,
  schoolUtilizationPieOption,
  totalUtilizationPieOption,
} from "./charts";
import type { UniversityReportData } from "./university";
import type { CollegeReportData } from "./college";
import type { ReportDetail, ReportListItem } from "./types";

async function fetchUniversityLogo(
  universityId: number | string,
): Promise<{ blob: Blob; mime: string } | null> {
  try {
    const res = await fetch(`/logos/${universityId}.png`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return { blob, mime: blob.type || "image/png" };
  } catch {
    return null;
  }
}

const ITEM_TYPE_ORDER = [
  "multiple_choice",
  "identification",
  "enumeration",
  "essay",
  "problem_solving",
  "code_on_paper",
  "visual",
] as const;

const ITEM_TYPE_LABELS: Record<string, string> = {
  multiple_choice: "MCQ",
  identification: "Identification",
  enumeration: "Enumeration",
  essay: "Essay",
  problem_solving: "Problem-solving",
  code_on_paper: "Code on Paper",
  visual: "Visuals",
};

const ITEM_TYPE_MINUTES: Record<string, number> = {
  multiple_choice: 80,
  identification: 80,
  code_on_paper: 80,
  enumeration: 40,
  essay: 200,
  problem_solving: 200,
  visual: 120,
};

export function hoursSavedItems(
  assessments: Array<{ itemType: string; totalTasks: number }>,
) {
  const counts: Record<string, number> = {};
  for (const k of ITEM_TYPE_ORDER) counts[k] = 0;
  for (const a of assessments) {
    if (a.itemType in counts) counts[a.itemType] += Number(a.totalTasks) || 0;
  }
  return ITEM_TYPE_ORDER.map((k) => ({
    key: k,
    label: ITEM_TYPE_LABELS[k],
    hours:
      Math.round(((counts[k] * (ITEM_TYPE_MINUTES[k] ?? 0)) / 60) * 10) / 10,
  }));
}

export type GenerateOutput = {
  docx: Blob;
  fromDate: string;
  toDate: string;
  filename: string;
};

function safeName(s: string | null | undefined): string {
  return (s ?? "report").replace(/[^A-Za-z0-9_-]+/g, "_");
}

export async function generateReportDocx(
  r: ReportListItem,
): Promise<GenerateOutput> {
  const tplRes = await apiFetch(`/api/reports/${r.id}/template`);
  if (!tplRes.ok) throw new Error(`template fetch ${tplRes.status}`);
  const templateBlob = await tplRes.blob();

  const detailRes = await apiFetch(`/api/reports/${r.id}`);
  if (!detailRes.ok) throw new Error(`detail fetch ${detailRes.status}`);
  const detail = (await detailRes.json()) as ReportDetail;

  const highlightsWithImages = await Promise.all(
    detail.productHighlights.map(async (h) => {
      let imageBlob: Blob | null = null;
      if (h.hasImage) {
        const imgRes = await apiFetch(
          `/api/reports/${r.id}/highlights/${h.id}/image`,
        );
        if (imgRes.ok) imageBlob = await imgRes.blob();
      }
      return {
        title: h.title,
        description: h.description,
        shortDescription: h.shortDescription,
        imageBlob,
        imageMime: h.imageMime,
      };
    }),
  );

  if (r.collegeId != null) {
    return await generateCollegeDocx(r, detail, templateBlob, highlightsWithImages);
  }
  return await generateUniversityDocx(r, detail, templateBlob, highlightsWithImages);
}

type Highlights = Array<{
  title: string;
  description: string;
  shortDescription: string;
  imageBlob: Blob | null;
  imageMime: string | null;
}>;

async function fetchCollegeAnalysis(
  schoolName: string,
  data: CollegeReportData,
  kind: "total" | "byDepartment",
  figureLabel?: string,
): Promise<string> {
  try {
    const res = await apiFetch("/api/reports/analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        schoolName,
        utilization: data.utilization,
        collegeName: data.collegeName,
        byDepartment: data.byDepartment,
        ...(figureLabel ? { figureLabel } : {}),
      }),
    });
    if (!res.ok) return "";
    const json = (await res.json()) as { text?: string };
    return json.text ?? "";
  } catch {
    return "";
  }
}

async function fetchCollegeRecommendations(
  schoolName: string,
  data: CollegeReportData,
  userRecommendations: string,
): Promise<Array<{ action: string; outcome: string }>> {
  try {
    const res = await apiFetch("/api/reports/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: "college",
        schoolName,
        collegeName: data.collegeName,
        utilization: data.utilization,
        byDepartment: data.byDepartment,
        userRecommendations,
      }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      recommendations?: Array<{ action: string; outcome: string }>;
    };
    return json.recommendations ?? [];
  } catch {
    return [];
  }
}

async function fetchUniversityAnalysis(
  schoolName: string,
  data: UniversityReportData,
  kind: "total" | "byCollege" | "byDepartment",
  extra?: {
    collegeName?: string;
    byDepartment?: UniversityReportData["byDepartment"];
    figureLabel?: string;
  },
): Promise<string> {
  try {
    const res = await apiFetch("/api/reports/analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        schoolName,
        utilization: data.utilization,
        byCollege: data.byCollege,
        ...(extra ?? {}),
      }),
    });
    if (!res.ok) return "";
    const json = (await res.json()) as { text?: string };
    return json.text ?? "";
  } catch {
    return "";
  }
}

async function fetchUniversityRecommendations(
  schoolName: string,
  data: UniversityReportData,
  userRecommendations: string,
): Promise<Array<{ action: string; outcome: string }>> {
  try {
    const res = await apiFetch("/api/reports/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolName,
        utilization: data.utilization,
        byCollege: data.byCollege,
        userRecommendations,
      }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      recommendations?: Array<{ action: string; outcome: string }>;
    };
    return json.recommendations ?? [];
  } catch {
    return [];
  }
}

async function generateCollegeDocx(
  r: ReportListItem,
  detail: ReportDetail,
  templateBlob: Blob,
  highlightsWithImages: Highlights,
): Promise<GenerateOutput> {
  const params = new URLSearchParams({
    universityId: String(r.universityId),
    collegeId: String(r.collegeId),
    startDate: r.dateFrom,
    endDate: r.dateTo,
  });
  const dataRes = await apiFetch(`/api/reports/college?${params}`);
  if (!dataRes.ok) throw new Error(`data fetch ${dataRes.status}`);
  const data = (await dataRes.json()) as CollegeReportData;

  const hasMultipleDepts = data.byDepartment.length > 1;
  const schoolName = r.universityName ?? "";

  const [
    collegePng,
    totalPng,
    deptPng,
    hoursSavedPng,
    totalAnalysis,
    byDepartmentAnalysis,
    recommendations,
    logo,
  ] = await Promise.all([
    renderChartToPng(
      collegeOverallUtilizationPieOption(
        data.utilization.active,
        data.utilization.total,
      ),
      600,
      400,
    ),
    renderChartToPng(
      totalUtilizationPieOption(
        data.utilization.active,
        data.utilization.total,
      ),
      600,
      400,
    ),
    hasMultipleDepts
      ? renderChartToPng(
          departmentUtilizationBarOption(data.byDepartment, data.collegeName),
          800,
          450,
        )
      : Promise.resolve(null),
    renderChartToPng(
      hoursSavedBarOption(hoursSavedItems(data.assessments)),
      800,
      450,
    ),
    fetchCollegeAnalysis(schoolName, data, "total", "1.1"),
    hasMultipleDepts
      ? fetchCollegeAnalysis(schoolName, data, "byDepartment", "1.2")
      : Promise.resolve(""),
    fetchCollegeRecommendations(schoolName, data, detail.recommendations ?? ""),
    fetchUniversityLogo(r.universityId),
  ]);

  const docx = await fillCollegeTemplate({
    templateBlob,
    schoolName,
    data,
    collegeUtilizationChartPng: collegePng,
    departmentUtilizationChartPng: deptPng,
    totalChartPng: totalPng,
    hoursSavedChartPng: hoursSavedPng,
    totalAnalysis,
    byDepartmentAnalysis,
    productHighlights: highlightsWithImages,
    teacherFeedbacks: detail.teacherFeedbacks,
    recommendations,
    logoBlob: logo?.blob ?? null,
    logoMime: logo?.mime ?? null,
  });

  return {
    docx,
    fromDate: data.dateRange.from,
    toDate: data.dateRange.to,
    filename: `${safeName(schoolName)}_${data.dateRange.from.slice(0, 10)}_${data.dateRange.to.slice(0, 10)}.docx`,
  };
}

async function generateUniversityDocx(
  r: ReportListItem,
  detail: ReportDetail,
  templateBlob: Blob,
  highlightsWithImages: Highlights,
): Promise<GenerateOutput> {
  const dataRes = await apiFetch(`/api/reports/university`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      universityId: String(r.universityId),
      startDate: r.dateFrom,
      endDate: r.dateTo,
      roster: detail.roster ?? [],
    }),
  });
  if (!dataRes.ok) throw new Error(`data fetch ${dataRes.status}`);
  const data = (await dataRes.json()) as UniversityReportData;
  const schoolName = r.universityName ?? "";

  const departmentGroups = (() => {
    const map = new Map<
      string,
      { collegeName: string; rows: UniversityReportData["byDepartment"] }
    >();
    for (const row of data.byDepartment) {
      const key = row.collegeId === null ? "null" : String(row.collegeId);
      const existing = map.get(key);
      if (existing) existing.rows.push(row);
      else map.set(key, { collegeName: row.collegeName, rows: [row] });
    }
    return Array.from(map.values()).filter((g) => g.rows.length > 1);
  })();

  const byCollegeDepartments = await Promise.all(
    departmentGroups.map(async (g, idx) => {
      const figureLabel = `1.${idx + 3}`;
      const [chartPng, analysis] = await Promise.all([
        renderChartToPng(
          departmentUtilizationBarOption(g.rows, g.collegeName),
          800,
          450,
        ),
        fetchUniversityAnalysis(schoolName, data, "byDepartment", {
          collegeName: g.collegeName,
          byDepartment: g.rows,
          figureLabel,
        }),
      ]);
      return { collegeName: g.collegeName, chartPng, analysis };
    }),
  );

  const [
    schoolPng,
    collegePng,
    totalPng,
    hoursSavedPng,
    totalAnalysis,
    byCollegeAnalysis,
    recommendations,
    logo,
  ] = await Promise.all([
    renderChartToPng(
      schoolUtilizationPieOption(
        data.utilization.active,
        data.utilization.total,
      ),
      600,
      400,
    ),
    renderChartToPng(collegeUtilizationBarOption(data.byCollege), 800, 450),
    renderChartToPng(
      totalUtilizationPieOption(
        data.utilization.active,
        data.utilization.total,
      ),
      600,
      400,
    ),
    renderChartToPng(
      hoursSavedBarOption(hoursSavedItems(data.assessments)),
      800,
      450,
    ),
    fetchUniversityAnalysis(schoolName, data, "total", { figureLabel: "1.1" }),
    fetchUniversityAnalysis(schoolName, data, "byCollege", { figureLabel: "1.2" }),
    fetchUniversityRecommendations(schoolName, data, detail.recommendations ?? ""),
    fetchUniversityLogo(r.universityId),
  ]);

  const docx = await fillUniversityTemplate({
    templateBlob,
    schoolName,
    data,
    schoolChartPng: schoolPng,
    collegeChartPng: collegePng,
    totalChartPng: totalPng,
    hoursSavedChartPng: hoursSavedPng,
    totalAnalysis,
    byCollegeAnalysis,
    byCollegeDepartments,
    productHighlights: highlightsWithImages,
    teacherFeedbacks: detail.teacherFeedbacks,
    recommendations,
    logoBlob: logo?.blob ?? null,
    logoMime: logo?.mime ?? null,
  });

  return {
    docx,
    fromDate: data.dateRange.from,
    toDate: data.dateRange.to,
    filename: `${safeName(schoolName)}_${data.dateRange.from.slice(0, 10)}_${data.dateRange.to.slice(0, 10)}.docx`,
  };
}
