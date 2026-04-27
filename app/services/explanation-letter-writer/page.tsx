"use client"

import dynamic from "next/dynamic"

const ExplanationLetterWriterClientPage = dynamic(() => import("./ExplanationLetterWriterClientPage"), {
  ssr: false,
  loading: () => (
    <div className="container mx-auto min-h-screen bg-gradient-to-br from-gray-100 to-gray-300 px-4 py-10 dark:from-neutral-950 dark:to-neutral-800">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-blue-600/15 ring-1 ring-blue-600/20" />
          <h1 className="text-4xl font-bold tracking-tight text-black dark:text-white">签证解释信生成器</h1>
          <p className="mt-4 text-xl text-neutral-700 dark:text-neutral-300">正在加载表单...</p>
        </div>
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white/70 p-8 text-center text-sm text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
          正在准备申请人信息、解释信模板和任务列表...
        </div>
      </div>
    </div>
  ),
})

export default function ExplanationLetterWriterPage() {
  return <ExplanationLetterWriterClientPage />
}
