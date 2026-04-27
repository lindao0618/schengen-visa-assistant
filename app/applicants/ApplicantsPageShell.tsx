"use client"

import dynamic from "next/dynamic"

const ApplicantsCrmClientPage = dynamic(() => import("./ApplicantsCrmClientPage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <div className="h-8 w-48 animate-pulse rounded-xl bg-slate-200" />
            <div className="h-4 w-72 max-w-full animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-11 w-32 animate-pulse rounded-xl bg-slate-200" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
          ))}
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 h-11 animate-pulse rounded-xl bg-slate-100" />
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="h-16 animate-pulse rounded-2xl bg-slate-50" />
            ))}
          </div>
        </div>
      </div>
    </div>
  ),
})

export function ApplicantsPageShell() {
  return <ApplicantsCrmClientPage />
}
