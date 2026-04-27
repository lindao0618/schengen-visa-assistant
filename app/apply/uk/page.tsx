"use client"

import dynamic from "next/dynamic"

const UKVisaApplicationClientPage = dynamic(() => import("./UKVisaApplicationClientPage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-12 pt-24">
        <div className="mb-12 space-y-3 text-center">
          <div className="mx-auto h-10 w-56 animate-pulse rounded-xl bg-zinc-800" />
          <div className="mx-auto h-5 w-96 max-w-full animate-pulse rounded bg-zinc-800" />
        </div>
        <div className="mx-auto max-w-4xl rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-6 h-10 w-48 animate-pulse rounded-lg bg-zinc-800" />
          <div className="space-y-5">
            {[0, 1].map((item) => (
              <div key={item} className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
                <div className="h-11 animate-pulse rounded-md bg-zinc-800" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  ),
})

export default function UKVisaApplicationPage() {
  return <UKVisaApplicationClientPage />
}
