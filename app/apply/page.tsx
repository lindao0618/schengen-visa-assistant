"use client"

import dynamic from "next/dynamic"

const ApplyClientPage = dynamic(() => import("./ApplyClientPage"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen flex-col bg-gray-100 dark:bg-gray-900">
      <main className="container mx-auto flex-grow px-4 py-8 pt-20">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="space-y-3">
            <div className="h-10 w-48 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
            <div className="h-5 w-80 max-w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <div className="mb-6 h-7 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-11 animate-pulse rounded-md bg-gray-100 dark:bg-gray-900" />
          </div>
        </div>
      </main>
    </div>
  ),
})

export default function ApplyPage() {
  return <ApplyClientPage />
}
