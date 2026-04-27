"use client"

import dynamic from "next/dynamic"

const ProfileClientPage = dynamic(() => import("./ProfileClientPage"), {
  ssr: false,
  loading: () => <ProfilePageSkeleton />,
})

export default function ProfilePage() {
  return <ProfileClientPage />
}

function ProfilePageSkeleton() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_34rem),linear-gradient(180deg,_#f8fafc,_#ffffff)] px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200" />
              <div className="h-9 w-36 animate-pulse rounded-xl bg-slate-200" />
              <div className="h-4 w-[min(36rem,80vw)] animate-pulse rounded bg-slate-100" />
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="h-14 w-14 animate-pulse rounded-full bg-slate-200" />
              <div className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white/90 p-1.5 shadow-sm md:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-11 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-7 w-32 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-64 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="h-10 w-20 animate-pulse rounded-xl bg-slate-100" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
