"use client"

import dynamic from "next/dynamic"

const VisaInfoClientPage = dynamic(() => import("./VisaInfoClientPage"), {
  ssr: false,
  loading: () => (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-3">
          <div className="h-10 w-48 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
          <div className="h-5 w-96 max-w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-900" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="h-64 animate-pulse rounded-xl border bg-white dark:bg-gray-900" />
          <div className="h-64 animate-pulse rounded-xl border bg-white dark:bg-gray-900 lg:col-span-2" />
        </div>
      </div>
    </div>
  ),
})

export default function VisaInfoPage() {
  return <VisaInfoClientPage />
}
