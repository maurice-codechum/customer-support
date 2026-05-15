"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import ReportForm from "../../_components/ReportForm";
import type { ReportDetail } from "@/utils/reports/types";
import { apiFetch } from "@/utils/apiFetch";

export default function EditReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const reportId = Number(id);
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    apiFetch(`/api/reports/${reportId}`, { signal: ctrl.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
        return data as ReportDetail;
      })
      .then(setDetail)
      .catch((err) => {
        if (err.name !== "AbortError") setError(String(err.message ?? err));
      });
    return () => ctrl.abort();
  }, [reportId]);

  if (error) {
    return (
      <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans min-h-screen">
        <main className="flex w-full max-w-3xl flex-col gap-4 py-16 px-8">
          <div className="text-sm text-red-600" role="alert">
            {error}
          </div>
          <Link href="/utilization-report" className="text-sm text-zinc-600 hover:underline">
            ← Back
          </Link>
        </main>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans min-h-screen">
        <main className="flex w-full max-w-3xl flex-col gap-4 py-16 px-8">
          <div className="text-sm text-zinc-500">Loading…</div>
        </main>
      </div>
    );
  }

  return (
    <ReportForm
      mode="edit"
      reportId={reportId}
      initial={{
        universityId: detail.universityId,
        collegeId: detail.collegeId,
        departmentId: detail.departmentId,
        dateFrom: detail.dateFrom,
        dateTo: detail.dateTo,
        templateName: detail.templateName,
        recommendations: detail.recommendations,
        productHighlights: detail.productHighlights,
        teacherFeedbacks: detail.teacherFeedbacks,
        roster: detail.roster ?? [],
      }}
    />
  );
}
