"use client"

import dynamic from "next/dynamic"

const DebugAuthClientPage = dynamic(() => import("./DebugAuthClientPage"), {
  ssr: false,
  loading: () => (
    <div className="container mx-auto space-y-4 p-8">
      <div className="h-8 w-44 animate-pulse rounded-lg bg-gray-200" />
      <div className="h-32 animate-pulse rounded bg-gray-100" />
      <div className="h-40 animate-pulse rounded bg-gray-100" />
    </div>
  ),
})

export default function DebugAuthPage() {
  return <DebugAuthClientPage />
}
