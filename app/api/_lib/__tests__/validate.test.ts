import { describe, it, expect } from "vitest";
import {
  CreateReportSchema,
  UpdateReportSchema,
  AnalysisSchema,
  RecommendationsSchema,
  CollegeQuerySchema,
  UniversityQuerySchema,
  UniversityBodySchema,
  stripControl,
} from "../validate";

const validTemplate = {
  name: "t.docx",
  dataBase64: "SGVsbG8=",
};

const validCreate = {
  universityId: 1,
  dateFrom: "2025-01-01",
  dateTo: "2025-01-31",
  template: validTemplate,
  productHighlights: [],
  teacherFeedbacks: [],
};

describe("CreateReportSchema", () => {
  it("accepts minimal valid input", () => {
    expect(CreateReportSchema.safeParse(validCreate).success).toBe(true);
  });

  it("rejects missing required field", () => {
    const r = CreateReportSchema.safeParse({ ...validCreate, dateFrom: undefined });
    expect(r.success).toBe(false);
  });

  it("rejects bad date format", () => {
    const r = CreateReportSchema.safeParse({ ...validCreate, dateFrom: "01-01-2025" });
    expect(r.success).toBe(false);
  });

  it("rejects oversized template", () => {
    const big = "A".repeat(26 * 1024 * 1024);
    const r = CreateReportSchema.safeParse({
      ...validCreate,
      template: { name: "x", dataBase64: big },
    });
    expect(r.success).toBe(false);
  });
});

describe("UpdateReportSchema", () => {
  it("makes template optional", () => {
    const r = UpdateReportSchema.safeParse({
      universityId: 1,
      dateFrom: "2025-01-01",
      dateTo: "2025-01-31",
      productHighlights: [],
      teacherFeedbacks: [],
    });
    expect(r.success).toBe(true);
  });
});

describe("AnalysisSchema", () => {
  it("requires a valid kind", () => {
    expect(AnalysisSchema.safeParse({ kind: "bogus" }).success).toBe(false);
    expect(AnalysisSchema.safeParse({ kind: "total" }).success).toBe(true);
  });
});

describe("RecommendationsSchema", () => {
  it("caps userRecommendations length", () => {
    const huge = "x".repeat(5000);
    expect(
      RecommendationsSchema.safeParse({ userRecommendations: huge }).success,
    ).toBe(false);
  });
});

describe("CollegeQuerySchema", () => {
  it("coerces collegeId to number", () => {
    const r = CollegeQuerySchema.safeParse({
      universityId: "1",
      collegeId: "42",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.collegeId).toBe(42);
  });
});

describe("UniversityQuerySchema / Body", () => {
  it("query requires universityId", () => {
    expect(UniversityQuerySchema.safeParse({}).success).toBe(false);
  });
  it("body stringifies numeric universityId", () => {
    const r = UniversityBodySchema.safeParse({ universityId: 7 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.universityId).toBe("7");
  });
});

describe("stripControl", () => {
  it("removes control chars but keeps printable", () => {
    expect(stripControl("hi\x00\x07there\x7f!")).toBe("hithere!");
    expect(stripControl("normal text 123")).toBe("normal text 123");
    // Tab (0x09), LF (0x0A), CR (0x0D) should be preserved by the class definition
    expect(stripControl("a\tb\nc\rd")).toBe("a\tb\nc\rd");
  });
});
