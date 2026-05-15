"use client";

import { useEffect, useRef, useState } from "react";
import ReportForm from "../_components/ReportForm";
import type { ReportDetail, ReportListItem } from "@/utils/reports/types";
import { apiFetch } from "@/utils/apiFetch";

function formatDateRange(from: string, to: string) {
  return `${from} → ${to}`;
}

function ReuseDropdown({
  reports,
  selectedId,
  onSelect,
  disabled,
  loadingDetail,
  pageError,
}: {
  reports: ReportListItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled: boolean;
  loadingDetail: boolean;
  pageError: string | null;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const selected = reports.find((r) => String(r.id) === selectedId) ?? null;

  const renderLines = (r: ReportListItem) => (
    <>
      <div className="font-medium text-black">
        {(r.universityName ?? `#${r.universityId}`)} ({formatDateRange(r.dateFrom, r.dateTo)})
      </div>
      {r.collegeName && (
        <div className="text-xs text-zinc-600">{r.collegeName}</div>
      )}
      {r.departmentName && (
        <div className="text-xs text-zinc-600">{r.departmentName}</div>
      )}
    </>
  );

  return (
    <div ref={rootRef} className="flex flex-col gap-1 text-sm relative">
      <span className="font-medium text-zinc-700">
        Reuse from existing report
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-left text-sm disabled:opacity-50 hover:bg-zinc-50"
      >
        {selected ? (
          renderLines(selected)
        ) : (
          <span className="text-zinc-500">— Start from scratch —</span>
        )}
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-80 overflow-y-auto rounded-md border border-zinc-300 bg-white shadow-lg">
          <button
            type="button"
            onClick={() => {
              onSelect("");
              setOpen(false);
            }}
            className="block w-full px-3 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-100 border-b border-dashed border-zinc-300"
          >
            — Start from scratch —
          </button>
          {reports.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                onSelect(String(r.id));
                setOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left hover:bg-zinc-100 ${
                i < reports.length - 1
                  ? "border-b border-dashed border-zinc-300"
                  : ""
              }`}
            >
              {renderLines(r)}
            </button>
          ))}
        </div>
      )}
      {loadingDetail && (
        <span className="text-xs text-zinc-500">Loading report data…</span>
      )}
      {pageError && (
        <span className="text-xs text-red-600" role="alert">
          {pageError}
        </span>
      )}
    </div>
  );
}

export default function CreateReportPage() {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [selectedReuseId, setSelectedReuseId] = useState("");
  const [reuseDetail, setReuseDetail] = useState<ReportDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    apiFetch("/api/reports", { signal: ctrl.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
        return data;
      })
      .then((data) => {
        if (Array.isArray(data)) setReports(data);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setPageError(String(err.message ?? err));
      })
      .finally(() => setLoadingReports(false));
    return () => ctrl.abort();
  }, []);

  const [reuseFile, setReuseFile] = useState<File | null>(null);
  const [reuseImages, setReuseImages] = useState<
    Record<number, { dataBase64: string; mime: string }>
  >({});

  useEffect(() => {
    if (!selectedReuseId) {
      setReuseDetail(null);
      setReuseFile(null);
      setReuseImages({});
      return;
    }
    const ctrl = new AbortController();
    setLoadingDetail(true);
    Promise.all([
      apiFetch(`/api/reports/${selectedReuseId}`, { signal: ctrl.signal }).then(
        async (r) => {
          const data = await r.json();
          if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
          return data as ReportDetail;
        },
      ),
      apiFetch(`/api/reports/${selectedReuseId}/template`, {
        signal: ctrl.signal,
      }).then(async (r) => {
        if (!r.ok) return null;
        return r.blob();
      }),
    ])
      .then(async ([detail, blob]) => {
        const nextFile = blob
          ? new File([blob], detail.templateName || "template.docx", {
              type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            })
          : null;

        const imgEntries = await Promise.all(
          detail.productHighlights
            .filter((h) => h.hasImage)
            .map(async (h) => {
              try {
                const imgRes = await apiFetch(
                  `/api/reports/${selectedReuseId}/highlights/${h.id}/image`,
                  { signal: ctrl.signal },
                );
                if (!imgRes.ok) return null;
                const imgBlob = await imgRes.blob();
                const buf = await imgBlob.arrayBuffer();
                const bytes = new Uint8Array(buf);
                let binary = "";
                const chunk = 0x8000;
                for (let i = 0; i < bytes.length; i += chunk) {
                  binary += String.fromCharCode(
                    ...bytes.subarray(i, i + chunk),
                  );
                }
                const dataBase64 = btoa(binary);
                return [
                  h.id,
                  { dataBase64, mime: h.imageMime || "image/png" },
                ] as const;
              } catch {
                return null;
              }
            }),
        );
        const images: Record<number, { dataBase64: string; mime: string }> = {};
        for (const entry of imgEntries) {
          if (entry) images[entry[0]] = entry[1];
        }
        setReuseFile(nextFile);
        setReuseImages(images);
        setReuseDetail(detail);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setPageError(String(err.message ?? err));
      })
      .finally(() => setLoadingDetail(false));
    return () => ctrl.abort();
  }, [selectedReuseId]);

  const initial = reuseDetail
    ? {
        universityId: reuseDetail.universityId,
        collegeId: reuseDetail.collegeId,
        departmentId: reuseDetail.departmentId,
        dateFrom: reuseDetail.dateFrom,
        dateTo: reuseDetail.dateTo,
        templateName: reuseDetail.templateName,
        recommendations: reuseDetail.recommendations,
        productHighlights: reuseDetail.productHighlights,
        teacherFeedbacks: reuseDetail.teacherFeedbacks,
        roster: reuseDetail.roster ?? [],
      }
    : undefined;

  return (
    <ReportForm
      key={reuseDetail?.id ?? "new"}
      initialFile={reuseFile}
      initialHighlightImages={reuseImages}
      mode="create"
      initial={initial}
      reuseSelector={
        <ReuseDropdown
          reports={reports}
          selectedId={selectedReuseId}
          onSelect={setSelectedReuseId}
          disabled={loadingReports}
          loadingDetail={loadingDetail}
          pageError={pageError}
        />
      }
    />
  );
}
