"use client"

import dynamic from "next/dynamic"

const USAVisaClientPage = dynamic(() => import("./USAVisaClientPage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 space-y-4 text-center">
          <div className="mx-auto h-12 w-72 max-w-full animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />
          <div className="mx-auto h-5 w-96 max-w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="mx-auto space-y-6">
          <div className="h-28 animate-pulse rounded-2xl bg-white shadow-sm dark:bg-gray-900" />
          <div className="grid gap-3 rounded-2xl bg-gray-100/80 p-2 dark:bg-black/50 md:grid-cols-5">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="h-10 animate-pulse rounded-xl bg-white dark:bg-gray-900" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-2xl bg-white shadow-sm dark:bg-gray-900" />
        </div>
      </div>
    </div>
  ),
})

export default function USAVisaPage() {
  return <USAVisaClientPage />
}
