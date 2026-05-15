import { describe, it, expect } from "vitest";
import { parseCsv, rosterFromCsv } from "../csv";

describe("parseCsv", () => {
  it("handles simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with commas", () => {
    expect(parseCsv('a,"b,c",d')).toEqual([["a", "b,c", "d"]]);
  });

  it("handles escaped quotes", () => {
    expect(parseCsv('a,"he said ""hi""",b')).toEqual([
      ["a", 'he said "hi"', "b"],
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("skips fully empty rows", () => {
    expect(parseCsv("a,b\n,\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("rosterFromCsv", () => {
  it("maps headers regardless of case/whitespace", () => {
    const csv = "Name, Email ,  College\nAlice,a@b.c,CCJ";
    expect(rosterFromCsv(csv)).toEqual([
      {
        name: "Alice",
        email: "a@b.c",
        college: "CCJ",
        department: null,
        courseCode: null,
        section: null,
      },
    ]);
  });

  it("drops rows without a name", () => {
    const csv = "Name,Email\n,nobody@x.y\nBob,b@c.d";
    expect(rosterFromCsv(csv).map((r) => r.name)).toEqual(["Bob"]);
  });

  it("matches department by Dept too", () => {
    const csv = "Name,Dept\nAlice,CS";
    expect(rosterFromCsv(csv)[0].department).toBe("CS");
  });
});
