"use client"

import dynamic from "next/dynamic"

const FranceSlotMonitorClientPage = dynamic(() => import("./FranceSlotMonitorClientPage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-50">
      <main className="container mx-auto max-w-6xl space-y-6 px-4 py-8 pt-20">
        <div className="space-y-3">
          <div className="h-9 w-64 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded bg-slate-200" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
          ))}
        </div>
        <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
      </main>
    </div>
  ),
})

export default function MonitorSettingsPage() {
  return <FranceSlotMonitorClientPage />
}
