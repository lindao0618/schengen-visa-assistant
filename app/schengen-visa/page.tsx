"use client"

import dynamic from "next/dynamic"

const SchengenVisaClientPage = dynamic(() => import("./SchengenVisaClientPage"), {
  ssr: false,
  loading: () => (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-white via-gray-50 to-gray-100 text-gray-900">
      <main className="container relative z-10 mx-auto flex-grow px-4 py-8 pt-20">
        <div className="space-y-8">
          <div className="space-y-3">
            <div className="h-10 w-56 animate-pulse rounded-xl bg-gray-200" />
            <div className="h-5 w-96 max-w-full animate-pulse rounded bg-gray-200" />
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-56 animate-pulse rounded-xl border border-gray-200 bg-white shadow-lg" />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-xl border border-gray-200 bg-white shadow-lg" />
        </div>
      </main>
    </div>
  ),
})

export default function SchengenVisaPage() {
  return <SchengenVisaClientPage />
}
