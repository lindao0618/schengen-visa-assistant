"use client"

import dynamic from "next/dynamic"

export type { BookingFormData, VisaSystemType } from "./types"

const AppointmentBookingClientPage = dynamic(() => import("./AppointmentBookingClientPage"), {
  ssr: false,
  loading: () => (
    <div className="container mx-auto max-w-5xl py-8">
      <h1 className="mb-8 text-center text-3xl font-bold">美签名额预约系统</h1>
      <div className="mb-10 space-y-3">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4, 5].map((step) => (
            <div key={step} className="flex flex-col items-center gap-2">
              <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
              <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
        <div className="h-[2px] w-full bg-gray-200" />
      </div>
      <div className="h-80 animate-pulse rounded-xl border border-gray-200 bg-white" />
    </div>
  ),
})

export default function AppointmentBookingPage() {
  return <AppointmentBookingClientPage />
}
