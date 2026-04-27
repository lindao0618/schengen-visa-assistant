"use client"

import dynamic from "next/dynamic"

const AdminUsersClientPage = dynamic(() => import("./AdminUsersClientPage"), {
  ssr: false,
  loading: () => <AdminPageLoading titleWidth="w-40" rows={7} />,
})

function AdminPageLoading({ titleWidth, rows }: { titleWidth: string; rows: number }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <div className={`h-9 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800 ${titleWidth}`} />
          <div className="h-4 w-80 max-w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="h-10 w-28 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-xl border bg-white dark:bg-gray-900" />
        ))}
      </div>
      <div className="rounded-xl border bg-white p-4 dark:bg-gray-900">
        <div className="mb-4 h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded-lg bg-gray-50 dark:bg-gray-800/70" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function UsersPage() {
  return <AdminUsersClientPage />
}
