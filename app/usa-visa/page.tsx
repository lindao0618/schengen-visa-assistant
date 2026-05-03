"use client"

import dynamic from "next/dynamic"

const USAVisaHomeClientPage = dynamic(() => import("./USAVisaHomeClientPage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-40 sm:px-6 lg:px-8">
        <div className="mb-9 h-80 animate-pulse rounded-[32px] border border-white/10 bg-white/[0.04]" />
        <div className="grid gap-8 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-80 animate-pulse rounded-[32px] border border-white/10 bg-white/[0.04]" />
          ))}
        </div>
      </div>
    </div>
  ),
})

export default function USAVisaPage() {
  return <USAVisaHomeClientPage />
}
