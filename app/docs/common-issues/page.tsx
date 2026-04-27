"use client"

import dynamic from "next/dynamic"

const CommonIssuesClientPage = dynamic(() => import("./CommonIssuesClientPage"), {
  ssr: false,
  loading: () => <CommonIssuesPageSkeleton />,
})

export default function CommonIssuesPage() {
  return <CommonIssuesClientPage />
}

function CommonIssuesPageSkeleton() {
  return (
    <main className="min-h-screen bg-black px-4 py-16 text-white">
      <section className="container mx-auto">
        <div className="mx-auto mb-12 max-w-3xl space-y-4 text-center">
          <div className="mx-auto h-7 w-28 animate-pulse rounded-full bg-zinc-800" />
          <div className="mx-auto h-12 w-[min(34rem,90vw)] animate-pulse rounded-2xl bg-zinc-800" />
          <div className="mx-auto h-5 w-[min(40rem,86vw)] animate-pulse rounded bg-zinc-900" />
        </div>
        <div className="mx-auto mb-12 h-11 max-w-2xl animate-pulse rounded-md bg-zinc-900" />
        <div className="mx-auto max-w-3xl space-y-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-20 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900" />
          ))}
        </div>
      </section>
    </main>
  )
}
