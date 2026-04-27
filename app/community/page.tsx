"use client"

import dynamic from "next/dynamic"

const CommunityClientPage = dynamic(() => import("./CommunityClientPage"), {
  ssr: false,
  loading: () => <CommunityPageSkeleton />,
})

export default function CommunityPage() {
  return <CommunityClientPage />
}

function CommunityPageSkeleton() {
  return (
    <main className="pt-20">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mx-auto mb-8 h-10 w-52 animate-pulse rounded-2xl bg-zinc-800" />
        <div className="mb-8 h-48 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900" />
        <div className="space-y-6">
          {[0, 1].map((item) => (
            <div key={item} className="h-36 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900" />
          ))}
        </div>
      </div>
    </main>
  )
}
