function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function run(text: string, bold: boolean): string {
  if (!text) return "";
  const rPr = bold ? "<w:rPr><w:b/><w:bCs/></w:rPr>" : "";
  return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

const PERCENT_RE = /\d+(?:\.\d+)?\s*%/g;

function buildRuns(text: string): string {
  if (!text) return "";
  const parts: string[] = [];
  let last = 0;
  for (const m of text.matchAll(PERCENT_RE)) {
    const start = m.index ?? 0;
    if (start > last) parts.push(run(text.slice(last, start), false));
    parts.push(run(m[0], true));
    last = start + m[0].length;
  }
  if (last < text.length) parts.push(run(text.slice(last), false));
  return parts.join("");
}

export function analysisToBoldPercentXml(
  text: string,
): { _type: "rawXml"; xml: string; replaceParagraph: boolean } | string {
  if (!text) return "";
  return {
    _type: "rawXml",
    xml: buildRuns(text),
    replaceParagraph: false,
  };
}
