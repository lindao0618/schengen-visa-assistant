"use client"

import dynamic from "next/dynamic"

const FranceBookingSuccessClientPage = dynamic(() => import("./FranceBookingSuccessClientPage"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <main className="container mx-auto flex-grow px-4 py-8 pt-20">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="space-y-3">
            <div className="h-10 w-48 animate-pulse rounded-xl bg-gray-200" />
            <div className="h-5 w-96 max-w-full animate-pulse rounded bg-gray-100" />
          </div>
          <div className="h-36 animate-pulse rounded-2xl bg-green-50 ring-1 ring-green-100" />
          <div className="grid gap-6 md:grid-cols-2">
            {[0, 1].map((item) => (
              <div key={item} className="h-56 animate-pulse rounded-2xl border border-gray-200 bg-white" />
            ))}
          </div>
        </div>
      </main>
    </div>
  ),
})

export default function BookingSuccessPage() {
  return <FranceBookingSuccessClientPage />
}
