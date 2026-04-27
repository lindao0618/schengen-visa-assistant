"use client"

import dynamic from "next/dynamic"

const MaterialReviewClientPage = dynamic(() => import("./MaterialReviewClientPage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-white pt-20">
      <div className="mx-auto max-w-4xl rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
        <div className="mb-6 h-8 w-36 animate-pulse rounded bg-gray-200" />
        <div className="space-y-4">
          <div className="h-12 animate-pulse rounded bg-gray-100" />
          <div className="h-32 animate-pulse rounded border border-dashed border-gray-200 bg-gray-50" />
          <div className="h-12 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
    </div>
  ),
})

export default function MaterialReviewPage() {
  return <MaterialReviewClientPage />
}
