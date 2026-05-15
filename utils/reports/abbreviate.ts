const STOPWORDS = new Set([
  "of",
  "and",
  "the",
  "for",
  "in",
  "on",
  "to",
  "a",
  "an",
]);

const ABBREVIATE_MIN_LENGTH = 16;

export function abbreviateCollege(name: string): string {
  if (!name) return "";
  if (name.length <= ABBREVIATE_MIN_LENGTH) return name;
  const totalWords = name.split(/\s+/).filter(Boolean).length;
  if (totalWords <= 3) return name;
  const m = name.match(/^college\s+of\s+(.+)$/i);
  const rest = m ? m[1] : name.replace(/^college\s+/i, "");
  const words = rest
    .split(/[\s,&\-/]+/)
    .map((w) => w.replace(/[^A-Za-z]/g, ""))
    .filter((w) => w && !STOPWORDS.has(w.toLowerCase()));
  const initials = words.map((w) => w[0].toUpperCase()).join("");
  return m ? "C" + initials : initials || name;
}

function initialsOf(segment: string): string {
  const words = segment
    .split(/[\s,&\-]+/)
    .map((w) => w.replace(/[^A-Za-z]/g, ""))
    .filter((w) => w && !STOPWORDS.has(w.toLowerCase()));
  return words.map((w) => w[0].toUpperCase()).join("");
}

const DEPARTMENT_CODES: Record<string, string> = {
  "mechanical engineering": "ME",
  "computer engineering": "CpE",
  "civil engineering": "CE",
  "chemical engineering": "ChE",
  "electrical engineering": "EE",
  "electronics engineering": "ECE",
  "electronics and communications engineering": "ECE",
  "industrial engineering": "IE",
  "mining engineering": "EM",
  "engineering management": "EM",
  "environmental and sanitary engineering": "ESE",
  "engineering mathematics, physics and chemistry": "DEMPC",
  "mathematics, physics and chemistry": "DEMPC",
  "architecture": "Architecture",
};

export function abbreviateDepartment(name: string): string {
  if (!name) return "";
  const trimmed = name.trim();
  const deptMatch = trimmed.match(/^department\s+of\s+(.+)$/i);
  if (deptMatch) {
    const subject = deptMatch[1].trim();
    if (subject.toLowerCase() === "accountancy") return "Accountancy";
    const key = subject.toLowerCase();
    if (DEPARTMENT_CODES[key]) return DEPARTMENT_CODES[key];
    return initialsOf(subject) || subject;
  }
  const key = trimmed.toLowerCase();
  if (DEPARTMENT_CODES[key]) return DEPARTMENT_CODES[key];
  const collegeMatch = trimmed.match(/^college\s+of\s+(.+)$/i);
  if (collegeMatch) return initialsOf(collegeMatch[1]) || trimmed;
  if (trimmed.includes("/")) {
    return trimmed
      .split("/")
      .map((seg) => initialsOf(seg) || seg.trim())
      .join("/");
  }
  return trimmed;
}
