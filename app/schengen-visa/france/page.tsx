"use client"

import dynamic from "next/dynamic"

const FranceVisaClientPage = dynamic(() => import("./FranceVisaClientPage"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <main className="container mx-auto flex-grow px-4 py-8 pt-20">
        <div className="mb-6 h-16 animate-pulse rounded-2xl bg-white/10" />
        <div className="rounded-xl border border-white/10 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
            <div className="h-5 w-16 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="space-y-4">
            <div className="h-12 animate-pulse rounded bg-gray-100" />
            <div className="h-12 animate-pulse rounded bg-gray-100" />
            <div className="h-24 animate-pulse rounded bg-gray-100" />
          </div>
        </div>
      </main>
    </div>
  ),
})

export default function FranceVisaPage() {
  return <FranceVisaClientPage />
}
