"use client"

import dynamic from "next/dynamic"

const ComprehensiveReviewClientPage = dynamic(() => import("./ComprehensiveReviewClientPage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="h-16 animate-pulse rounded-3xl bg-white shadow-sm" />
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 h-8 w-56 animate-pulse rounded bg-slate-200" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-32 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
})

export default function ComprehensiveMaterialReviewPage() {
  return <ComprehensiveReviewClientPage />
}
