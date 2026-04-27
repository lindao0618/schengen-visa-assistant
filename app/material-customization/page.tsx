"use client"

import dynamic from "next/dynamic"

const MaterialCustomizationClientPage = dynamic(() => import("./MaterialCustomizationClientPage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-300 px-4 py-10 dark:from-neutral-950 dark:to-neutral-800">
      <div className="container mx-auto space-y-8">
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white/70 p-8 text-center text-sm text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
          正在加载材料定制服务...
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-48 animate-pulse rounded-xl border border-gray-200/70 bg-white/60 shadow-lg dark:border-neutral-700/70 dark:bg-neutral-800/60"
            />
          ))}
        </div>
      </div>
    </div>
  ),
})

export default function MaterialCustomizationPage() {
  return <MaterialCustomizationClientPage />
}
