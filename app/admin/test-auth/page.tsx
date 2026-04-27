"use client"

import dynamic from "next/dynamic"

const AdminTestAuthClientPage = dynamic(() => import("./AdminTestAuthClientPage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-900">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="h-64 animate-pulse rounded-xl border bg-white dark:bg-gray-950" />
      </div>
    </div>
  ),
})

export default function TestAuthPage() {
  return <AdminTestAuthClientPage />
}
