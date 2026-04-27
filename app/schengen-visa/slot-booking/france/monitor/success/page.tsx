"use client"

import dynamic from "next/dynamic"

const FranceMonitorSuccessClientPage = dynamic(() => import("./FranceMonitorSuccessClientPage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-8 space-y-3">
          <div className="h-10 w-72 max-w-full animate-pulse rounded-xl bg-gray-200" />
          <div className="h-5 w-96 max-w-full animate-pulse rounded bg-gray-200" />
        </div>
        <div className="mb-8 grid gap-6 md:grid-cols-2">
          {[0, 1].map((item) => (
            <div key={item} className="h-44 animate-pulse rounded-xl border border-gray-200 bg-gray-50" />
          ))}
        </div>
        <div className="h-56 animate-pulse rounded-xl border border-gray-200 bg-gray-50" />
      </div>
    </div>
  ),
})

export default function MonitorSuccessPage() {
  return <FranceMonitorSuccessClientPage />
}
