"use client"

import dynamic from "next/dynamic"

const LoginClientPage = dynamic(() => import("./LoginClientPage"), {
  ssr: false,
  loading: () => <LoginPageSkeleton />,
})

export default function LoginPage() {
  return <LoginClientPage />
}

function LoginPageSkeleton() {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_34rem),radial-gradient(circle_at_bottom_right,_#dcfce7,_transparent_30rem),linear-gradient(135deg,_#f8fafc,_#ffffff)] px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-center">
          <section className="hidden space-y-6 lg:block">
            <div className="h-7 w-44 animate-pulse rounded-full bg-slate-200" />
            <div className="space-y-4">
              <div className="h-14 w-[min(38rem,70vw)] animate-pulse rounded-2xl bg-slate-200" />
              <div className="h-14 w-[min(30rem,60vw)] animate-pulse rounded-2xl bg-slate-200" />
              <div className="h-5 w-[min(34rem,65vw)] animate-pulse rounded bg-slate-100" />
            </div>
            <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
              {[0, 1].map((item) => (
                <div key={item} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white/70" />
              ))}
            </div>
          </section>

          <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60">
            <div className="mb-7 space-y-3">
              <div className="h-11 w-11 animate-pulse rounded-2xl bg-slate-200" />
              <div className="h-8 w-32 animate-pulse rounded-xl bg-slate-200" />
              <div className="h-4 w-60 max-w-full animate-pulse rounded bg-slate-100" />
            </div>
            <div className="space-y-4">
              {[0, 1].map((item) => (
                <div key={item} className="space-y-2">
                  <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
                  <div className="h-10 animate-pulse rounded-md bg-slate-100" />
                </div>
              ))}
              <div className="h-11 animate-pulse rounded-md bg-slate-200" />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
