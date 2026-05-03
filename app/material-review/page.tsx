"use client"

import dynamic from "next/dynamic"

const AuditEngineHomeClientPage = dynamic(() => import("./AuditEngineHomeClientPage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-black px-4 pt-36 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="h-10 w-44 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="h-16 max-w-2xl animate-pulse rounded-3xl bg-white/[0.06]" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-[32px] border border-white/5 bg-white/[0.03]" />
          <div className="h-72 animate-pulse rounded-[32px] border border-white/5 bg-white/[0.03]" />
        </div>
      </div>
    </div>
  ),
})

export default function MaterialReviewPage() {
  return <AuditEngineHomeClientPage />
}
