import type { RosterRow } from "@/utils/reports/types";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((v) => v.trim() !== "")) rows.push(row);
  }
  return rows;
}

export function normalizeHeader(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function rosterFromCsv(text: string): RosterRow[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0].map(normalizeHeader);
  const findCol = (...keys: string[]): number => {
    for (const k of keys) {
      const idx = header.findIndex((h) => h.includes(k));
      if (idx !== -1) return idx;
    }
    return -1;
  };
  const nameIdx = findCol("name");
  const emailIdx = findCol("email");
  const collegeIdx = findCol("college");
  const deptIdx = findCol("department", "dept");
  const courseIdx = findCol("course code", "course");
  const sectionIdx = findCol("section");

  const out: RosterRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const cell = (idx: number) => (idx >= 0 ? (r[idx] ?? "").trim() : "");
    const name = cell(nameIdx);
    if (!name) continue;
    out.push({
      name,
      email: cell(emailIdx) || null,
      college: cell(collegeIdx) || null,
      department: cell(deptIdx) || null,
      courseCode: cell(courseIdx) || null,
      section: cell(sectionIdx) || null,
    });
  }
  return out;
}
