"use client"

import dynamic from "next/dynamic"

const SchengenSlotBookingClientPage = dynamic(() => import("./SchengenSlotBookingClientPage"), {
  ssr: false,
  loading: () => (
    <div className="relative flex min-h-screen flex-col bg-white text-gray-900">
      <main className="container relative z-10 mx-auto flex-grow px-6 py-12 pt-24">
        <div className="space-y-10">
          <div className="space-y-3">
            <div className="h-10 w-72 max-w-full animate-pulse rounded-xl bg-gray-200" />
            <div className="h-5 w-96 max-w-full animate-pulse rounded bg-gray-100" />
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            {[0, 1].map((item) => (
              <div key={item} className="h-96 animate-pulse rounded-2xl bg-white shadow-lg ring-1 ring-gray-100" />
            ))}
          </div>
          <div className="h-52 animate-pulse rounded-2xl bg-gray-50 shadow-sm" />
        </div>
      </main>
    </div>
  ),
})

export default function SlotBookingPage() {
  return <SchengenSlotBookingClientPage />
}
