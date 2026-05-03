"use client"

import dynamic from "next/dynamic"

const MaterialReviewClientPage = dynamic(() => import("../MaterialReviewClientPage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-black px-4 pt-36 text-white">
      <div className="mx-auto max-w-4xl rounded-[32px] border border-white/5 bg-white/[0.03] p-6">
        <div className="mb-6 h-8 w-36 animate-pulse rounded bg-white/10" />
        <div className="space-y-4">
          <div className="h-12 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-32 animate-pulse rounded border border-dashed border-white/10 bg-white/[0.03]" />
          <div className="h-12 animate-pulse rounded bg-white/[0.06]" />
        </div>
      </div>
    </div>
  ),
})

export default function IndividualMaterialReviewPage() {
  return <MaterialReviewClientPage />
}
