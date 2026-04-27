"use client"

import dynamic from "next/dynamic"

const DashboardClientPage = dynamic(() => import("./DashboardClientPage"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 to-gray-200 text-gray-900 md:flex-row">
      <aside className="w-full shrink-0 border-b border-gray-200/80 bg-white/80 p-4 shadow-lg backdrop-blur-md md:w-72 md:border-b-0 md:border-r md:p-6">
        <div className="mb-6 h-8 w-28 animate-pulse rounded-lg bg-gray-200" />
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="h-11 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      </aside>
      <main className="flex-1 p-6 md:p-10">
        <div className="h-64 animate-pulse rounded-xl border border-gray-200/50 bg-white/70 shadow-xl" />
      </main>
    </div>
  ),
})

export default function DashboardPage() {
  return <DashboardClientPage />
}
