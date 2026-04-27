"use client"

import dynamic from "next/dynamic"

const HotelBookingForm = dynamic(() => import("./HotelBookingForm").then((module) => module.HotelBookingForm), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-900">
      <div className="mb-6 h-7 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-10 animate-pulse rounded-md bg-gray-100 dark:bg-gray-950" />
          </div>
        ))}
      </div>
    </div>
  ),
})

export function HotelBookingFormLoader() {
  return <HotelBookingForm />
}
