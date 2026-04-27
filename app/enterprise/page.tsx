"use client"

import dynamic from "next/dynamic"

const EnterpriseClientPage = dynamic(() => import("./EnterpriseClientPage"), {
  ssr: false,
  loading: () => <EnterprisePageSkeleton />,
})

export default function EnterprisePage() {
  return <EnterpriseClientPage />
}

function EnterprisePageSkeleton() {
  return (
    <main className="min-h-screen bg-black px-4 py-16 text-white">
      <section className="container mx-auto">
        <div className="mx-auto mb-16 max-w-3xl space-y-4 text-center">
          <div className="mx-auto h-7 w-32 animate-pulse rounded-full bg-zinc-800" />
          <div className="mx-auto h-12 w-[min(38rem,90vw)] animate-pulse rounded-2xl bg-zinc-800" />
          <div className="mx-auto h-5 w-[min(44rem,86vw)] animate-pulse rounded bg-zinc-900" />
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="h-40 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
          ))}
        </div>
      </section>
    </main>
  )
}
