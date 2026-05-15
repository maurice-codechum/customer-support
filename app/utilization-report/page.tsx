"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReportListItem } from "@/utils/reports/types";
import { generateReportDocx } from "@/utils/reports/generateReport";
import { apiFetch } from "@/utils/apiFetch";

type ColumnKey =
  | "school"
  | "college"
  | "department"
  | "range"
  | "template"
  | "created";

type Column = {
  key: ColumnKey;
  label: string;
  show: (rows: ReportListItem[]) => boolean;
  render: (r: ReportListItem) => React.ReactNode;
  cellCls?: string;
};

const COLUMNS: Column[] = [
  {
    key: "school",
    label: "School",
    show: () => true,
    render: (r) => r.universityName ?? `#${r.universityId}`,
    cellCls: "text-black",
  },
  {
    key: "college",
    label: "College",
    show: (rows) => rows.some((r) => r.collegeId !== null),
    render: (r) =>
      r.collegeId === null ? "—" : (r.collegeName ?? `#${r.collegeId}`),
    cellCls: "text-zinc-700",
  },
  {
    key: "department",
    label: "Department",
    show: (rows) => rows.some((r) => r.departmentId !== null),
    render: (r) =>
      r.departmentId === null
        ? "—"
        : (r.departmentName ?? `#${r.departmentId}`),
    cellCls: "text-zinc-700",
  },
  {
    key: "range",
    label: "Date Range",
    show: () => true,
    render: (r) => `${r.dateFrom} → ${r.dateTo}`,
    cellCls: "text-zinc-700",
  },
  {
    key: "template",
    label: "Template",
    show: () => true,
    render: (r) => r.templateName,
    cellCls: "text-zinc-700",
  },
  {
    key: "created",
    label: "Created",
    show: () => true,
    render: (r) => new Date(r.createdAt).toLocaleString(),
    cellCls: "text-zinc-500",
  },
];

export default function Home() {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ReportListItem | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const confirmCancelRef = useRef<HTMLButtonElement | null>(null);
  const triggerBeforeDeleteRef = useRef<HTMLElement | null>(null);

  const loadReports = useCallback((signal?: AbortSignal) => {
    return apiFetch("/api/reports", { signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
        return data;
      })
      .then((data) => {
        if (Array.isArray(data)) setReports(data);
        else setError("Failed to load reports");
      })
      .catch((err) => {
        if (err?.name !== "AbortError")
          setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    loadReports(ctrl.signal).finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [loadReports]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") loadReports();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadReports]);

  useEffect(() => {
    if (openMenuId === null) return;
    const onDown = (e: MouseEvent) => {
      if (
        menuWrapRef.current &&
        !menuWrapRef.current.contains(e.target as Node)
      ) {
        setOpenMenuId(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuId(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenuId]);

  useEffect(() => {
    if (confirmDelete) {
      confirmCancelRef.current?.focus();
    } else if (triggerBeforeDeleteRef.current) {
      triggerBeforeDeleteRef.current.focus();
      triggerBeforeDeleteRef.current = null;
    }
  }, [confirmDelete]);

  const handleGenerate = async (r: ReportListItem) => {
    setOpenMenuId(null);
    setBusyId(r.id);
    setError(null);
    try {
      const { docx, filename } = await generateReportDocx(r);
      const url = URL.createObjectURL(docx);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setDeleting(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/reports/${target.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setReports((prev) => prev.filter((x) => x.id !== target.id));
      setConfirmDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  const visibleCols = COLUMNS.filter((c) => c.show(reports));

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans min-h-screen">
      <main className="flex w-full max-w-4xl flex-col gap-6 py-16 px-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-black">Utilization Reports</h1>
          <Link
            href="/utilization-report/new"
            className="h-10 px-4 inline-flex items-center rounded-md bg-black text-white font-medium text-sm hover:opacity-90"
          >
            Create Report
          </Link>
        </div>

        {loading && <div className="text-sm text-zinc-500">Loading…</div>}
        {error && (
          <div className="text-sm text-red-600" role="alert">
            {error}
          </div>
        )}

        {!loading && !error && reports.length === 0 && (
          <div className="rounded-md border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
            No reports yet. Click{" "}
            <span className="font-medium">Create Report</span> to add one.
          </div>
        )}

        {reports.length > 0 && (
          <div className="rounded-lg border border-zinc-200 bg-white overflow-visible">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-zinc-600">
                <tr>
                  {visibleCols.map((c) => (
                    <th
                      key={c.key}
                      className="text-left font-medium px-4 py-2"
                    >
                      {c.label}
                    </th>
                  ))}
                  <th className="px-4 py-2 w-12" />
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-200">
                    {visibleCols.map((c) => (
                      <td
                        key={c.key}
                        className={`px-4 py-2 ${c.cellCls ?? ""}`}
                      >
                        {c.render(r)}
                      </td>
                    ))}
                    <td className="px-2 py-2 relative text-right">
                      <div
                        className="inline-block relative"
                        ref={openMenuId === r.id ? menuWrapRef : undefined}
                      >
                        <button
                          type="button"
                          aria-label="Row actions"
                          aria-haspopup="menu"
                          aria-expanded={openMenuId === r.id}
                          ref={openMenuId === r.id ? menuButtonRef : undefined}
                          disabled={busyId === r.id}
                          onClick={() =>
                            setOpenMenuId(openMenuId === r.id ? null : r.id)
                          }
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-zinc-100 text-zinc-600 disabled:opacity-50"
                        >
                          <span className="text-lg leading-none">⋯</span>
                        </button>
                        {openMenuId === r.id && (
                          <div
                            role="menu"
                            className="absolute right-0 mt-1 z-10 min-w-[180px] rounded-md border border-zinc-200 bg-white shadow-md py-1"
                          >
                            <Link
                              role="menuitem"
                              href={`/utilization-report/${r.id}/edit`}
                              onClick={() => setOpenMenuId(null)}
                              className="block w-full text-left px-3 py-2 text-sm hover:bg-zinc-100"
                            >
                              Edit
                            </Link>
                            <button
                              role="menuitem"
                              type="button"
                              onClick={() => handleGenerate(r)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-100"
                            >
                              Generate Report
                            </button>
                            <button
                              role="menuitem"
                              type="button"
                              onClick={(e) => {
                                triggerBeforeDeleteRef.current =
                                  e.currentTarget;
                                setOpenMenuId(null);
                                setConfirmDelete(r);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {busyId !== null && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 right-4 z-40 inline-flex items-center gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 shadow-lg"
        >
          <span
            className="h-4 w-4 rounded-full border-2 border-zinc-300 border-t-zinc-700 animate-spin"
            aria-hidden
          />
          <span className="text-sm text-zinc-700">
            Generating report
            {(() => {
              const r = reports.find((x) => x.id === busyId);
              return r ? ` for ${r.universityName ?? `#${r.universityId}`}` : "";
            })()}
            …
          </span>
        </div>
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => !deleting && setConfirmDelete(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-title"
            className="w-full max-w-md rounded-lg bg-white shadow-lg p-6 mx-4"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape" && !deleting) setConfirmDelete(null);
            }}
          >
            <h2
              id="confirm-delete-title"
              className="text-lg font-semibold text-black"
            >
              Delete report?
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              {confirmDelete.universityName ?? `#${confirmDelete.universityId}`}{" "}
              ({confirmDelete.dateFrom} → {confirmDelete.dateTo}) will be
              permanently removed. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                ref={confirmCancelRef}
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDelete(null)}
                className="h-9 px-4 rounded-md border border-zinc-300 text-sm hover:bg-zinc-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="h-9 px-4 rounded-md bg-red-600 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
