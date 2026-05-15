import { MimeType, TemplateHandler } from "easy-template-x";
import type { CollegeReportData } from "./college";
import type {
  FillProductHighlight,
  FillTeacherFeedback,
} from "./fillUniversityTemplate";
import { abbreviateCollege, abbreviateDepartment } from "./abbreviate";
import { analysisToBoldPercentXml } from "./analysisXml";

const MINUTES_PER_TASK: Record<string, number> = {
  multiple_choice: 80,
  identification: 80,
  code_on_paper: 80,
  enumeration: 40,
  essay: 200,
  problem_solving: 200,
  visual: 120,
};

function fmtTime(minutes: number): string {
  return (minutes / 60).toFixed(1).replace(/\.0$/, "");
}

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function fmtMonthDay(s: string): string {
  const d = new Date((s || "").slice(0, 10) + "T00:00:00Z");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function fmtMonthDayYear(s: string): string {
  const d = new Date((s || "").slice(0, 10) + "T00:00:00Z");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function mimeToFormat(mime: string | null | undefined): MimeType {
  switch ((mime || "").toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return MimeType.Jpeg;
    case "image/gif":
      return MimeType.Gif;
    case "image/bmp":
      return MimeType.Bmp;
    case "image/svg+xml":
      return MimeType.Svg;
    default:
      return MimeType.Png;
  }
}

export async function fillCollegeTemplate(args: {
  templateBlob: Blob;
  schoolName: string;
  data: CollegeReportData;
  collegeUtilizationChartPng: Blob;
  departmentUtilizationChartPng?: Blob | null;
  totalChartPng: Blob;
  hoursSavedChartPng: Blob;
  totalAnalysis?: string;
  byDepartmentAnalysis?: string;
  productHighlights?: FillProductHighlight[];
  teacherFeedbacks?: FillTeacherFeedback[];
  recommendations?: Array<{ action: string; outcome: string }>;
  logoBlob?: Blob | null;
  logoMime?: string | null;
}): Promise<Blob> {
  const buf = await args.templateBlob.arrayBuffer();
  const { data } = args;

  const productHighlights = (args.productHighlights ?? []).map((h, i) => ({
    number: i + 1,
    title: h.title,
    description: h.description,
    short_description: h.shortDescription,
    image: h.imageBlob
      ? {
          _type: "image",
          source: h.imageBlob,
          format: mimeToFormat(h.imageMime),
        }
      : "",
  }));

  const teacherFeedbacks = (args.teacherFeedbacks ?? []).map((f) => ({
    teacher_name: f.teacherName,
    department_name: f.departmentName,
    feedback: f.feedback,
  }));

  const hasMultipleDepts = data.byDepartment.length > 1;
  const hasDeptChart = hasMultipleDepts && !!args.departmentUtilizationChartPng;
  const deptChart = hasDeptChart
    ? {
        _type: "image",
        source: args.departmentUtilizationChartPng,
        format: MimeType.Png,
      }
    : "";
  const deptAnalysis = hasMultipleDepts
    ? analysisToBoldPercentXml(args.byDepartmentAnalysis ?? "")
    : "";

  const counts: Record<string, number> = {
    multiple_choice: 0,
    identification: 0,
    enumeration: 0,
    essay: 0,
    problem_solving: 0,
    code_on_paper: 0,
    visual: 0,
  };
  for (const a of data.assessments) {
    if (a.itemType in counts) {
      counts[a.itemType] += Number(a.totalTasks) || 0;
    }
  }
  const minutesFor = (type: string) =>
    counts[type] * (MINUTES_PER_TASK[type] ?? 0);
  const totalMinutes = Object.keys(counts).reduce(
    (sum, t) => sum + minutesFor(t),
    0,
  );

  const logo = args.logoBlob
    ? {
        _type: "image",
        source: args.logoBlob,
        format: mimeToFormat(args.logoMime),
      }
    : "";

  const tagData = {
    school_name: args.schoolName,
    logo,
    college_name: data.collegeName,
    date_from: fmtMonthDay(data.dateRange.from),
    date_to: fmtMonthDayYear(data.dateRange.to),
    active_teachers: data.utilization.active,
    activities_created: data.activitiesCreated,
    hours_saved: Math.round(data.hoursSaved),
    college_utilization_chart: {
      _type: "image",
      source: args.collegeUtilizationChartPng,
      format: MimeType.Png,
    },
    has_dept_chart: hasDeptChart,
    department_utilization_chart: deptChart,
    hours_saved_chart: {
      _type: "image",
      source: args.hoursSavedChartPng,
      format: MimeType.Png,
    },
    total_utilization_chart: {
      _type: "image",
      source: args.totalChartPng,
      format: MimeType.Png,
    },
    total_utilization_analysis: analysisToBoldPercentXml(args.totalAnalysis ?? ""),
    utilization_by_dept_chart: deptChart,
    utilization_by_dept_analysis: deptAnalysis,
    top_n_teachers: data.topTeachers.length,
    top_teachers: data.topTeachers.map((t, i) => ({
      rank: i + 1,
      teacher_name: t.teacherName,
      department_name: abbreviateDepartment(t.departmentName),
      college_name: abbreviateCollege(data.collegeName),
      activities_created: t.activitiesCreated,
      scanned_papers: t.scannedPapers,
    })),
    product_highlights: productHighlights,
    has_product_highlights: productHighlights.length > 0,
    teacher_feedbacks: teacherFeedbacks,
    has_teacher_feedbacks: teacherFeedbacks.length > 0,
    recommendations: (args.recommendations ?? []).map((r) => ({
      action: r.action,
      outcome: r.outcome,
    })),
    has_recommendations: (args.recommendations ?? []).length > 0,
    mc_count: counts.multiple_choice,
    mc_time_saved: fmtTime(minutesFor("multiple_choice")),
    id_count: counts.identification,
    id_time_saved: fmtTime(minutesFor("identification")),
    enum_count: counts.enumeration,
    enum_time_saved: fmtTime(minutesFor("enumeration")),
    essay_count: counts.essay,
    essay_time_saved: fmtTime(minutesFor("essay")),
    ps_count: counts.problem_solving,
    ps_time_saved: fmtTime(minutesFor("problem_solving")),
    cop_count: counts.code_on_paper,
    cop_time_saved: fmtTime(minutesFor("code_on_paper")),
    visual_count: counts.visual,
    visual_time_saved: fmtTime(minutesFor("visual")),
    total_time_saved: fmtTime(totalMinutes),
  };

  const handler = new TemplateHandler();
  const out = await handler.process(buf, tagData);
  return new Blob([out as BlobPart], { type: DOCX_MIME });
}
