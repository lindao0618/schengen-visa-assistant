"use client"

import dynamic from "next/dynamic"

const AdminLogsClientPage = dynamic(() => import("./AdminLogsClientPage"), {
  ssr: false,
  loading: () => (
    <div className="space-y-6">
      <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm dark:bg-slate-950">
        <div className="mb-4 h-6 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
        <div className="space-y-3">
          <div className="h-9 w-44 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded bg-slate-100 dark:bg-slate-900" />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-2xl border bg-slate-50 dark:bg-slate-900" />
          ))}
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(24rem,0.8fr)]">
        <div className="h-[34rem] animate-pulse rounded-xl border bg-white dark:bg-slate-950" />
        <div className="h-[34rem] animate-pulse rounded-xl border bg-white dark:bg-slate-950" />
      </div>
    </div>
  ),
})

export default function AdminLogsPage() {
  return <AdminLogsClientPage />
}
