import { z } from "zod";

const MAX_TEMPLATE_BASE64 = 25 * 1024 * 1024;
const MAX_IMAGE_BASE64 = 10 * 1024 * 1024;
const MAX_TEXT = 64 * 1024;
const MAX_USER_RECS = 4 * 1024;
const MAX_ARRAY = 500;

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

const base64 = z.string().regex(/^[A-Za-z0-9+/=\s]*$/, "expected base64");

const idNum = z.coerce.number().int().positive();
const idNullable = z
  .union([z.coerce.number().int().positive(), z.null()])
  .optional()
  .nullable();

const Template = z.object({
  name: z.string().min(1).max(255),
  dataBase64: base64.max(MAX_TEMPLATE_BASE64, "template too large"),
});

const Image = z
  .object({
    dataBase64: base64.max(MAX_IMAGE_BASE64, "image too large"),
    mime: z.string().min(1).max(100),
  })
  .nullable()
  .optional();

const ProductHighlight = z.object({
  title: z.string().max(MAX_TEXT),
  description: z.string().max(MAX_TEXT),
  shortDescription: z.string().max(MAX_TEXT),
  image: Image,
});

const ProductHighlightUpdate = ProductHighlight.extend({
  existingId: z.number().int().positive().optional(),
  keepImage: z.boolean().optional(),
});

const TeacherFeedback = z.object({
  teacherName: z.string().max(MAX_TEXT),
  departmentName: z.string().max(MAX_TEXT),
  feedback: z.string().max(MAX_TEXT),
});

const RosterEntry = z.object({
  name: z.string().min(1).max(MAX_TEXT),
  email: z.string().max(MAX_TEXT).nullable().optional(),
  college: z.string().max(MAX_TEXT).nullable().optional(),
  department: z.string().max(MAX_TEXT).nullable().optional(),
  courseCode: z.string().max(MAX_TEXT).nullable().optional(),
  section: z.string().max(MAX_TEXT).nullable().optional(),
});

export const CreateReportSchema = z.object({
  universityId: idNum,
  collegeId: idNullable,
  departmentId: idNullable,
  dateFrom: dateStr,
  dateTo: dateStr,
  template: Template,
  recommendations: z.string().max(MAX_TEXT).nullable().optional(),
  productHighlights: z.array(ProductHighlight).max(MAX_ARRAY),
  teacherFeedbacks: z.array(TeacherFeedback).max(MAX_ARRAY),
  roster: z.array(RosterEntry).max(MAX_ARRAY).optional(),
});

export const UpdateReportSchema = z.object({
  universityId: idNum,
  collegeId: idNullable,
  departmentId: idNullable,
  dateFrom: dateStr,
  dateTo: dateStr,
  template: Template.optional(),
  recommendations: z.string().max(MAX_TEXT).nullable().optional(),
  productHighlights: z.array(ProductHighlightUpdate).max(MAX_ARRAY),
  teacherFeedbacks: z.array(TeacherFeedback).max(MAX_ARRAY),
  roster: z.array(RosterEntry).max(MAX_ARRAY).optional(),
});

const CollegeRow = z.object({
  collegeName: z.string().max(MAX_TEXT),
  rate: z.union([z.number(), z.string()]),
  active: z.number().optional(),
  total: z.number().optional(),
});

const DepartmentRow = z.object({
  departmentName: z.string().max(MAX_TEXT),
  rate: z.union([z.number(), z.string()]),
  active: z.number().optional(),
  total: z.number().optional(),
});

const Utilization = z.object({
  active: z.number(),
  total: z.number(),
  rate: z.number(),
});

export const AnalysisSchema = z.object({
  kind: z.enum(["total", "byCollege", "byDepartment"]),
  schoolName: z.string().max(MAX_TEXT).optional(),
  collegeName: z.string().max(MAX_TEXT).optional(),
  figureLabel: z.string().max(64).optional(),
  utilization: Utilization.optional(),
  byCollege: z.array(CollegeRow).max(MAX_ARRAY).optional(),
  byDepartment: z.array(DepartmentRow).max(MAX_ARRAY).optional(),
});

export const RecommendationsSchema = z.object({
  scope: z.enum(["university", "college"]).optional(),
  schoolName: z.string().max(MAX_TEXT).optional(),
  collegeName: z.string().max(MAX_TEXT).optional(),
  utilization: Utilization.optional(),
  byCollege: z.array(CollegeRow).max(MAX_ARRAY).optional(),
  byDepartment: z.array(DepartmentRow).max(MAX_ARRAY).optional(),
  userRecommendations: z.string().max(MAX_USER_RECS).nullable().optional(),
});

export const CollegeQuerySchema = z.object({
  universityId: z.string().min(1).max(64),
  collegeId: z.coerce.number().int().positive(),
  startDate: dateStr.optional(),
  endDate: dateStr.optional(),
});

export const UniversityQuerySchema = z.object({
  universityId: z.string().min(1).max(64),
  startDate: dateStr.optional(),
  endDate: dateStr.optional(),
});

export const UniversityBodySchema = z.object({
  universityId: z.union([z.string(), z.number()]).transform((v) => String(v)),
  startDate: dateStr.optional(),
  endDate: dateStr.optional(),
  roster: z.array(RosterEntry).max(MAX_ARRAY).optional(),
});

export function stripControl(s: string): string {
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

export type CreateReportInputZ = z.infer<typeof CreateReportSchema>;
export type UpdateReportInputZ = z.infer<typeof UpdateReportSchema>;
