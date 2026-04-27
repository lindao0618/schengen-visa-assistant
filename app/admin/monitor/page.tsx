"use client"

import dynamic from "next/dynamic"

const AdminMonitorClientPage = dynamic(() => import("./AdminMonitorClientPage"), {
  ssr: false,
  loading: () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-9 w-40 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
          <div className="h-5 w-72 max-w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="h-10 w-28 animate-pulse rounded-md bg-gray-200 dark:bg-gray-800" />
      </div>
      <div className="grid gap-6 md:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-36 animate-pulse rounded-xl border bg-white dark:bg-gray-950" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-xl border bg-white dark:bg-gray-950" />
    </div>
  ),
})

export default function MonitorPage() {
  return <AdminMonitorClientPage />
}
