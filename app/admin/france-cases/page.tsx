"use client"

import dynamic from "next/dynamic"

const AdminFranceCasesClientPage = dynamic(() => import("./AdminFranceCasesClientPage"), {
  ssr: false,
  loading: () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <div className="h-9 w-52 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-24 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
          <div className="h-10 w-36 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-xl border bg-white dark:bg-gray-900" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-xl border bg-white dark:bg-gray-900" />
      <div className="h-80 animate-pulse rounded-xl border bg-white dark:bg-gray-900" />
    </div>
  ),
})

export default function AdminFranceCasesPage() {
  return <AdminFranceCasesClientPage />
}
