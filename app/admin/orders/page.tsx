"use client"

import dynamic from "next/dynamic"

const AdminOrdersClientPage = dynamic(() => import("./AdminOrdersClientPage"), {
  ssr: false,
  loading: () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-9 w-40 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
          <div className="h-5 w-72 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-20 animate-pulse rounded-md bg-gray-200 dark:bg-gray-800" />
          <div className="h-10 w-20 animate-pulse rounded-md bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>
      <div className="h-20 animate-pulse rounded-xl border bg-white dark:bg-gray-950" />
      <div className="h-96 animate-pulse rounded-xl border bg-white dark:bg-gray-950" />
    </div>
  ),
})

export default function OrdersPage() {
  return <AdminOrdersClientPage />
}
