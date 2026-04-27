"use client"

import dynamic from "next/dynamic"

const ApplicantDetailClientPage = dynamic(() => import("./ApplicantDetailClientPage"), {
  ssr: false,
  loading: () => <ApplicantDetailLoadingSkeleton />,
})

export default function ApplicantDetailClientEntry({
  applicantId,
  viewerRole,
}: {
  applicantId: string
  viewerRole?: string | null
}) {
  return <ApplicantDetailClientPage applicantId={applicantId} viewerRole={viewerRole} />
}

function ApplicantDetailLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_32rem),linear-gradient(180deg,_#f8fafc,_#ffffff)] px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-sm">
          <div className="mb-6 h-4 w-36 animate-pulse rounded bg-slate-200" />
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="h-9 w-64 animate-pulse rounded-xl bg-slate-200" />
              <div className="h-4 w-[min(34rem,80vw)] animate-pulse rounded bg-slate-100" />
            </div>
            <div className="flex gap-3">
              <div className="h-10 w-24 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-100" />
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-sm">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-11 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1, 2, 3, 4, 5].map((item) => (
                <div key={item} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
