"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/utils/apiFetch";
import { rosterFromCsv } from "./csv";
import type {
  ProductHighlightInput,
  ReportDetail,
  RosterRow,
  TeacherFeedbackInput,
  UpdateReportHighlightInput,
} from "@/utils/reports/types";

type Option = { id: string | number; name: string };

type Initial = {
  universityId: number;
  collegeId: number | null;
  departmentId: number | null;
  dateFrom: string;
  dateTo: string;
  templateName: string;
  recommendations: string | null;
  productHighlights: ReportDetail["productHighlights"];
  teacherFeedbacks: ReportDetail["teacherFeedbacks"];
  roster?: RosterRow[];
};

type Props =
  | {
      mode: "create";
      reportId?: undefined;
      initial?: Initial;
      initialFile?: File | null;
      initialHighlightImages?: Record<
        number,
        { dataBase64: string; mime: string }
      >;
      reuseSelector?: ReactNode;
    }
  | {
      mode: "edit";
      reportId: number;
      initial: Initial;
      initialFile?: undefined;
      initialHighlightImages?: undefined;
      reuseSelector?: undefined;
    };

type HighlightRow = ProductHighlightInput & {
  existingId?: number;
  keepImage?: boolean;
  existingImageMime?: string | null;
};

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export default function ReportForm({
  mode,
  reportId,
  initial,
  initialFile,
  initialHighlightImages,
  reuseSelector,
}: Props) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const hasInitial = !!initial;

  const [schools, setSchools] = useState<Option[]>([]);
  const [colleges, setColleges] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [schoolId, setSchoolId] = useState(
    hasInitial ? String(initial.universityId) : "",
  );
  const [collegeId, setCollegeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [startDate, setStartDate] = useState(
    hasInitial ? initial.dateFrom : "",
  );
  const [endDate, setEndDate] = useState(hasInitial ? initial.dateTo : "");

  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [roster, setRoster] = useState<RosterRow[]>(
    hasInitial ? (initial.roster ?? []) : [],
  );
  const [rosterFileName, setRosterFileName] = useState<string | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const rosterInputRef = useRef<HTMLInputElement>(null);

  const onRosterFile = async (f: File | null) => {
    setRosterError(null);
    if (!f) {
      setRoster([]);
      setRosterFileName(null);
      return;
    }
    try {
      const text = await f.text();
      const parsed = rosterFromCsv(text);
      if (parsed.length === 0) {
        setRosterError("No rows parsed from CSV.");
        return;
      }
      setRoster(parsed);
      setRosterFileName(f.name);
    } catch (err) {
      setRosterError(err instanceof Error ? err.message : String(err));
    }
  };

  const [highlights, setHighlights] = useState<HighlightRow[]>(
    hasInitial
      ? initial.productHighlights.map((h) => {
          const reuseImg = initialHighlightImages?.[h.id];
          return {
            existingId: isEdit ? h.id : undefined,
            title: h.title,
            description: h.description,
            shortDescription: h.shortDescription,
            image: reuseImg ? { dataBase64: reuseImg.dataBase64, mime: reuseImg.mime } : null,
            keepImage: isEdit && h.hasImage,
            existingImageMime: h.hasImage ? h.imageMime : null,
          };
        })
      : [],
  );
  const [feedbacks, setFeedbacks] = useState<TeacherFeedbackInput[]>(
    hasInitial
      ? initial.teacherFeedbacks.map((f) => ({
          teacherName: f.teacherName,
          departmentName: f.departmentName,
          feedback: f.feedback,
        }))
      : [],
  );
  const [recommendations, setRecommendations] = useState(
    hasInitial ? (initial.recommendations ?? "") : "",
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prefillCollegeRef = useRef(
    hasInitial && initial.collegeId !== null
      ? String(initial.collegeId)
      : null,
  );
  const prefillDepartmentRef = useRef(
    hasInitial && initial.departmentId !== null
      ? String(initial.departmentId)
      : null,
  );

  useEffect(() => {
    const ctrl = new AbortController();
    apiFetch("/api/schools", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => setSchools(Array.isArray(data) ? data : []))
      .catch((err) => {
        if (err.name !== "AbortError") console.error(err);
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    setColleges([]);
    setCollegeId("");
    setDepartments([]);
    setDepartmentId("");
    if (!schoolId) return;
    const ctrl = new AbortController();
    apiFetch(`/api/schools/${schoolId}/colleges`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setColleges(list);
        if (prefillCollegeRef.current) {
          const want = prefillCollegeRef.current;
          if (list.some((c: Option) => String(c.id) === want)) {
            setCollegeId(want);
          }
          prefillCollegeRef.current = null;
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") console.error(err);
      });
    return () => ctrl.abort();
  }, [schoolId]);

  useEffect(() => {
    setDepartments([]);
    setDepartmentId("");
    if (!schoolId || !collegeId) return;
    const ctrl = new AbortController();
    apiFetch(`/api/schools/${schoolId}/colleges/${collegeId}/departments`, {
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setDepartments(list);
        if (prefillDepartmentRef.current) {
          const want = prefillDepartmentRef.current;
          if (list.some((d: Option) => String(d.id) === want)) {
            setDepartmentId(want);
          }
          prefillDepartmentRef.current = null;
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") console.error(err);
      });
    return () => ctrl.abort();
  }, [schoolId, collegeId]);

  const addHighlight = () =>
    setHighlights((prev) => [
      ...prev,
      { title: "", description: "", shortDescription: "", image: null },
    ]);
  const removeHighlight = (i: number) =>
    setHighlights((prev) => prev.filter((_, idx) => idx !== i));
  const updateHighlight = (i: number, patch: Partial<HighlightRow>) =>
    setHighlights((prev) =>
      prev.map((h, idx) => (idx === i ? { ...h, ...patch } : h)),
    );

  const onHighlightImage = async (i: number, f: File | null) => {
    if (!f) {
      updateHighlight(i, { image: null });
      return;
    }
    const dataBase64 = await fileToBase64(f);
    updateHighlight(i, {
      image: { dataBase64, mime: f.type || "image/png" },
      keepImage: false,
    });
  };

  const addFeedback = () =>
    setFeedbacks((prev) => [
      ...prev,
      { teacherName: "", departmentName: "", feedback: "" },
    ]);
  const removeFeedback = (i: number) =>
    setFeedbacks((prev) => prev.filter((_, idx) => idx !== i));
  const updateFeedback = (i: number, patch: Partial<TeacherFeedbackInput>) =>
    setFeedbacks((prev) =>
      prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)),
    );

  const canSubmit =
    !!schoolId &&
    !!startDate &&
    !!endDate &&
    !submitting &&
    (isEdit || !!file);

  const handleSubmit = async () => {
    if (!schoolId) return;
    if (!isEdit && !file) return;
    setSubmitting(true);
    setError(null);
    try {
      let template: { name: string; dataBase64: string } | undefined;
      if (file) {
        template = { name: file.name, dataBase64: await fileToBase64(file) };
      }

      if (isEdit) {
        const productHighlights: UpdateReportHighlightInput[] = highlights.map(
          (h) => ({
            existingId: h.existingId,
            keepImage: h.image ? false : !!h.keepImage,
            title: h.title,
            description: h.description,
            shortDescription: h.shortDescription,
            image: h.image ?? null,
          }),
        );
        const body = {
          universityId: Number(schoolId),
          collegeId: collegeId ? Number(collegeId) : null,
          departmentId: departmentId ? Number(departmentId) : null,
          dateFrom: startDate,
          dateTo: endDate,
          template,
          recommendations: recommendations.trim() || null,
          productHighlights,
          teacherFeedbacks: feedbacks,
          roster,
        };
        const res = await apiFetch(`/api/reports/${reportId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      } else {
        const body = {
          universityId: Number(schoolId),
          collegeId: collegeId ? Number(collegeId) : null,
          departmentId: departmentId ? Number(departmentId) : null,
          dateFrom: startDate,
          dateTo: endDate,
          template,
          recommendations: recommendations.trim() || null,
          productHighlights: highlights.map((h) => ({
            title: h.title,
            description: h.description,
            shortDescription: h.shortDescription,
            image: h.image ?? null,
          })),
          teacherFeedbacks: feedbacks,
          roster,
        };
        const res = await apiFetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      router.push("/utilization-report");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  const inputCls =
    "h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm";
  const labelCls = "flex flex-col gap-1 text-sm";
  const labelSpan = "font-medium text-zinc-700";

  const submitLabel = isEdit
    ? submitting
      ? "Saving…"
      : "Save Changes"
    : submitting
      ? "Creating…"
      : "Create Report";

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans min-h-screen">
      <main className="flex w-full max-w-3xl flex-col gap-6 py-16 px-8 bg-white my-8 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-black">
            {isEdit ? "Edit Report" : "Create Report"}
          </h1>
          <Link href="/utilization-report" className="text-sm text-zinc-600 hover:underline">
            ← Back
          </Link>
        </div>

        {reuseSelector}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className={labelCls}>
            <span className={labelSpan}>School</span>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className={inputCls}
            >
              <option value="">Select school</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            <span className={labelSpan}>College</span>
            <select
              value={collegeId}
              onChange={(e) => setCollegeId(e.target.value)}
              disabled={!schoolId}
              className={`${inputCls} disabled:opacity-50`}
            >
              <option value="">Select college</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            <span className={labelSpan}>Department</span>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              disabled={!collegeId}
              className={`${inputCls} disabled:opacity-50`}
            >
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className={labelCls}>
            <span className={labelSpan}>From</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className={labelCls}>
            <span className={labelSpan}>To</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <span className={labelSpan}>
            {isEdit ? "Template (.docx)" : "Upload Template (.docx)"}
          </span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 h-32 rounded-md border-2 border-dashed border-zinc-300 bg-zinc-50 hover:bg-zinc-100 transition-colors text-sm text-zinc-600"
          >
            {file ? (
              <span className="font-medium text-black">{file.name}</span>
            ) : isEdit ? (
              <>
                <span className="font-medium text-black">
                  {initial.templateName}
                </span>
                <span className="text-xs text-zinc-500">
                  Click to replace (optional)
                </span>
              </>
            ) : (
              <>
                <span>Click to upload .docx file</span>
                <span className="text-xs text-zinc-500">or drag and drop</span>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <span className={labelSpan}>Teacher Roster (.csv, optional)</span>
          <button
            type="button"
            onClick={() => rosterInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 h-24 rounded-md border-2 border-dashed border-zinc-300 bg-zinc-50 hover:bg-zinc-100 transition-colors text-sm text-zinc-600"
          >
            {rosterFileName ? (
              <span className="font-medium text-black">
                {rosterFileName} — {roster.length} teachers
              </span>
            ) : roster.length > 0 ? (
              <span className="font-medium text-black">
                {roster.length} teachers loaded
              </span>
            ) : (
              <>
                <span>Click to upload roster .csv</span>
                <span className="text-xs text-zinc-500">
                  Name, Email, College, Department, Course Code, Section
                </span>
              </>
            )}
          </button>
          <input
            ref={rosterInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => onRosterFile(e.target.files?.[0] ?? null)}
          />
          {rosterError && (
            <span className="text-xs text-red-600">{rosterError}</span>
          )}
          {roster.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setRoster([]);
                setRosterFileName(null);
                if (rosterInputRef.current) rosterInputRef.current.value = "";
              }}
              className="self-start text-xs text-red-600 hover:underline"
            >
              Clear roster
            </button>
          )}
        </div>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-black">
              Product Highlights
            </h2>
            <button
              type="button"
              onClick={addHighlight}
              className="h-8 px-3 rounded-md border border-zinc-300 text-sm hover:bg-zinc-100"
            >
              + Add highlight
            </button>
          </div>
          {highlights.length === 0 && (
            <div className="text-sm text-zinc-500">No highlights yet.</div>
          )}
          {highlights.map((h, i) => (
            <div
              key={h.existingId ?? `new-${i}`}
              className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-600">
                  Highlight #{i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeHighlight(i)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
              <label className={labelCls}>
                <span className={labelSpan}>Title</span>
                <input
                  value={h.title}
                  onChange={(e) =>
                    updateHighlight(i, { title: e.target.value })
                  }
                  className={inputCls}
                />
              </label>
              <label className={labelCls}>
                <span className={labelSpan}>Short description</span>
                <input
                  value={h.shortDescription}
                  onChange={(e) =>
                    updateHighlight(i, { shortDescription: e.target.value })
                  }
                  className={inputCls}
                />
              </label>
              <label className={labelCls}>
                <span className={labelSpan}>Description</span>
                <textarea
                  value={h.description}
                  onChange={(e) =>
                    updateHighlight(i, { description: e.target.value })
                  }
                  rows={3}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className={labelCls}>
                <span className={labelSpan}>Image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    onHighlightImage(i, e.target.files?.[0] ?? null)
                  }
                  className="text-sm"
                />
                {h.image ? (
                  <span className="text-xs text-zinc-500">
                    {h.image.mime} •{" "}
                    {Math.round((h.image.dataBase64.length * 3) / 4 / 1024)} KB
                  </span>
                ) : h.keepImage ? (
                  <span className="text-xs text-zinc-500">
                    Existing image kept
                    {h.existingImageMime ? ` (${h.existingImageMime})` : ""}
                  </span>
                ) : null}
              </label>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-black">
              Teacher Feedbacks
            </h2>
            <button
              type="button"
              onClick={addFeedback}
              className="h-8 px-3 rounded-md border border-zinc-300 text-sm hover:bg-zinc-100"
            >
              + Add feedback
            </button>
          </div>
          {feedbacks.length === 0 && (
            <div className="text-sm text-zinc-500">No feedbacks yet.</div>
          )}
          {feedbacks.map((f, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-600">
                  Feedback #{i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeFeedback(i)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={labelCls}>
                  <span className={labelSpan}>Teacher name</span>
                  <input
                    value={f.teacherName}
                    onChange={(e) =>
                      updateFeedback(i, { teacherName: e.target.value })
                    }
                    className={inputCls}
                  />
                </label>
                <label className={labelCls}>
                  <span className={labelSpan}>Department</span>
                  <input
                    value={f.departmentName}
                    onChange={(e) =>
                      updateFeedback(i, { departmentName: e.target.value })
                    }
                    className={inputCls}
                  />
                </label>
              </div>
              <label className={labelCls}>
                <span className={labelSpan}>Feedback</span>
                <textarea
                  value={f.feedback}
                  onChange={(e) =>
                    updateFeedback(i, { feedback: e.target.value })
                  }
                  rows={3}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>
          ))}
        </section>

        <label className={labelCls}>
          <span className={labelSpan}>Recommendations (optional)</span>
          <textarea
            value={recommendations}
            onChange={(e) => setRecommendations(e.target.value)}
            rows={4}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 h-11 rounded-md bg-black text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </div>
      </main>
    </div>
  );
}
