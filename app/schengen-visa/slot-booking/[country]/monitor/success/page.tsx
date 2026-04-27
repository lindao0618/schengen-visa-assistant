"use client"

import dynamic from "next/dynamic"

const MonitorSuccessClientPage = dynamic(() => import("./MonitorSuccessClientPage"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <main className="container mx-auto flex-grow px-4 py-8 pt-20">
        <div className="space-y-8">
          <div className="space-y-3">
            <div className="h-10 w-72 max-w-full animate-pulse rounded-xl bg-gray-800" />
            <div className="h-5 w-96 max-w-full animate-pulse rounded bg-gray-800" />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {[0, 1].map((item) => (
              <div key={item} className="h-44 animate-pulse rounded-xl border border-gray-800 bg-gray-900/50" />
            ))}
          </div>
          <div className="h-56 animate-pulse rounded-xl border border-gray-800 bg-gray-900/50" />
        </div>
      </main>
    </div>
  ),
})

export default function MonitorSuccessPage() {
  return <MonitorSuccessClientPage />
}
