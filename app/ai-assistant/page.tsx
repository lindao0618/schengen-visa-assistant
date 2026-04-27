"use client"

import dynamic from "next/dynamic"

const AIAssistantClientPage = dynamic(() => import("./AIAssistantClientPage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-12 text-center">
          <div className="mx-auto mb-6 h-16 w-16 animate-pulse rounded-xl bg-gray-200" />
          <div className="mx-auto mb-4 h-12 w-64 animate-pulse rounded-lg bg-gray-200" />
          <div className="mx-auto h-6 w-full max-w-xl animate-pulse rounded bg-gray-100" />
        </div>
        <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
          <div className="h-[500px] space-y-4 bg-gray-50 p-6">
            <div className="h-16 w-2/3 animate-pulse rounded-2xl bg-white" />
            <div className="ml-auto h-14 w-1/2 animate-pulse rounded-2xl bg-gray-200" />
            <div className="h-24 w-3/4 animate-pulse rounded-2xl bg-white" />
          </div>
          <div className="border-t border-gray-200 bg-white p-4">
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-14 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
            <div className="h-14 animate-pulse rounded-lg bg-gray-100" />
          </div>
        </div>
      </div>
    </div>
  ),
})

export default function AIAssistantPage() {
  return <AIAssistantClientPage />
}
