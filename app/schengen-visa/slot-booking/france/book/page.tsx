"use client"

import dynamic from "next/dynamic"

const FranceSlotBookingClientPage = dynamic(() => import("./FranceSlotBookingClientPage"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <main className="container mx-auto flex-grow px-4 py-8 pt-20">
        <div className="mb-6 h-20 animate-pulse rounded-2xl bg-gray-100" />
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-10 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
          <div className="space-y-4">
            <div className="h-12 animate-pulse rounded bg-gray-100" />
            <div className="h-12 animate-pulse rounded bg-gray-100" />
            <div className="h-28 animate-pulse rounded bg-gray-100" />
          </div>
        </div>
      </main>
    </div>
  ),
})

export default function BookingPage() {
  return <FranceSlotBookingClientPage />
}
