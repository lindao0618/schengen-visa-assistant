"use client"

import dynamic from "next/dynamic"

const DebugBookingClientPage = dynamic(() => import("./DebugBookingClientPage"), {
  ssr: false,
  loading: () => (
    <div className="container mx-auto px-4 py-8">
      <div className="h-96 animate-pulse rounded-xl border bg-white" />
    </div>
  ),
})

export default function DebugBookingPage() {
  return <DebugBookingClientPage />
}
