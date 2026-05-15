export type ProductHighlightInput = {
  title: string;
  description: string;
  shortDescription: string;
  image?: { dataBase64: string; mime: string } | null;
};

export type TeacherFeedbackInput = {
  teacherName: string;
  departmentName: string;
  feedback: string;
};

export type RosterRow = {
  name: string;
  email: string | null;
  college: string | null;
  department: string | null;
  courseCode: string | null;
  section: string | null;
};

export type CreateReportInput = {
  universityId: number;
  collegeId?: number | null;
  departmentId?: number | null;
  dateFrom: string;
  dateTo: string;
  template: { name: string; dataBase64: string };
  recommendations?: string | null;
  productHighlights: ProductHighlightInput[];
  teacherFeedbacks: TeacherFeedbackInput[];
  roster?: RosterRow[];
};

export type UpdateReportHighlightInput = ProductHighlightInput & {
  existingId?: number;
  keepImage?: boolean;
};

export type UpdateReportInput = {
  universityId: number;
  collegeId?: number | null;
  departmentId?: number | null;
  dateFrom: string;
  dateTo: string;
  recommendations?: string | null;
  template?: { name: string; dataBase64: string };
  productHighlights: UpdateReportHighlightInput[];
  teacherFeedbacks: TeacherFeedbackInput[];
  roster?: RosterRow[];
};

export type ReportListItem = {
  id: number;
  universityId: number;
  universityName: string | null;
  collegeId: number | null;
  collegeName: string | null;
  departmentId: number | null;
  departmentName: string | null;
  dateFrom: string;
  dateTo: string;
  templateName: string;
  createdAt: string;
};

export type ReportDetail = ReportListItem & {
  recommendations: string | null;
  productHighlights: Array<{
    id: number;
    position: number;
    title: string;
    description: string;
    shortDescription: string;
    hasImage: boolean;
    imageMime: string | null;
  }>;
  teacherFeedbacks: Array<{
    id: number;
    position: number;
    teacherName: string;
    departmentName: string;
    feedback: string;
  }>;
  roster: RosterRow[];
};
