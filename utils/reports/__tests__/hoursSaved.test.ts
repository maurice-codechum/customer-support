import { describe, it, expect } from "vitest";

import { hoursSavedItems } from "../generateReport";

describe("hoursSavedItems", () => {
  it("returns all item types in order, zero for missing", () => {
    const out = hoursSavedItems([]);
    expect(out.map((o) => o.key)).toEqual([
      "multiple_choice",
      "identification",
      "enumeration",
      "essay",
      "problem_solving",
      "code_on_paper",
      "visual",
    ]);
    expect(out.every((o) => o.hours === 0)).toBe(true);
  });

  it("computes hours: count * minutes / 60, rounded to 0.1", () => {
    const out = hoursSavedItems([
      { itemType: "essay", totalTasks: 3 },
      { itemType: "multiple_choice", totalTasks: 6 },
    ]);
    const essay = out.find((o) => o.key === "essay")!;
    const mcq = out.find((o) => o.key === "multiple_choice")!;
    expect(essay.hours).toBe(10);
    expect(mcq.hours).toBe(8);
  });

  it("ignores unknown item types", () => {
    const out = hoursSavedItems([
      { itemType: "ghost", totalTasks: 100 },
    ]);
    expect(out.every((o) => o.hours === 0)).toBe(true);
  });

  it("sums multiple entries of same kind", () => {
    const out = hoursSavedItems([
      { itemType: "enumeration", totalTasks: 3 },
      { itemType: "enumeration", totalTasks: 3 },
    ]);
    // 6 tasks * 40 / 60 = 4
    expect(out.find((o) => o.key === "enumeration")!.hours).toBe(4);
  });
});
