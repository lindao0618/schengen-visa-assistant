"use client"

import dynamic from "next/dynamic"

const AdminDocumentsClientPage = dynamic(() => import("./AdminDocumentsClientPage"), {
  ssr: false,
  loading: () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-3">
          <div className="h-9 w-48 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
          <div className="h-4 w-72 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="h-10 w-24 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
      </div>
      <div className="h-32 animate-pulse rounded-xl border bg-white dark:bg-gray-900" />
      <div className="rounded-xl border bg-white p-4 dark:bg-gray-900">
        <div className="mb-4 h-8 w-36 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="h-12 animate-pulse rounded-lg bg-gray-50 dark:bg-gray-800/70" />
          ))}
        </div>
      </div>
    </div>
  ),
})

export default function AdminDocumentsPage() {
  return <AdminDocumentsClientPage />
}
