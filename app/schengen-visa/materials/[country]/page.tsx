"use client"

import dynamic from "next/dynamic"

const CountryMaterialsClientPage = dynamic(() => import("./CountryMaterialsClientPage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-4">
          <div className="h-10 w-10 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
          <div className="space-y-2">
            <div className="h-8 w-64 max-w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
            <div className="h-4 w-72 max-w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        </div>
        <div className="mb-6 h-28 animate-pulse rounded-2xl bg-white shadow-sm dark:bg-gray-900" />
        <div className="h-[520px] animate-pulse rounded-2xl bg-white shadow-sm dark:bg-gray-900" />
      </div>
    </div>
  ),
})

export default function CountryMaterialsPage() {
  return <CountryMaterialsClientPage />
}
