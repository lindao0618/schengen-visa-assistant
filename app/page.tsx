"use client"

import dynamic from "next/dynamic"

const HomeClientPage = dynamic(() => import("./HomeClientPage"), {
  ssr: false,
  loading: () => <HomePageSkeleton />,
})

export default function Home() {
  return <HomeClientPage />
}

function HomePageSkeleton() {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_34rem),linear-gradient(180deg,_#ffffff,_#f1f5f9)] px-4 py-12 dark:bg-[radial-gradient(circle_at_top_left,_rgba(30,64,175,0.22),_transparent_34rem),linear-gradient(180deg,_#020617,_#020617)]">
      <section className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl flex-col items-center justify-center text-center">
        <div className="mb-8 h-16 w-16 animate-pulse rounded-2xl bg-slate-200 shadow-lg dark:bg-slate-800" />
        <div className="mb-4 h-14 w-[min(36rem,86vw)] animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="mb-3 h-5 w-[min(44rem,90vw)] animate-pulse rounded bg-slate-100 dark:bg-slate-900" />
        <div className="mb-8 h-5 w-[min(32rem,78vw)] animate-pulse rounded bg-slate-100 dark:bg-slate-900" />
        <div className="flex gap-4">
          <div className="h-11 w-28 animate-pulse rounded-md bg-slate-900 dark:bg-slate-700" />
          <div className="h-11 w-28 animate-pulse rounded-md border border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-900" />
        </div>
        <div className="mt-14 grid w-full gap-4 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white/75 shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
            />
          ))}
        </div>
      </section>
    </main>
  )
}
