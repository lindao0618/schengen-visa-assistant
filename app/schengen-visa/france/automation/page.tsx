"use client"

import dynamic from "next/dynamic"

const FranceAutomationClientPage = dynamic(() => import("./FranceAutomationClientPage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 px-4 py-8 dark:from-gray-900 dark:to-black">
      <div className="container mx-auto rounded-3xl border border-dashed border-gray-200 bg-white/70 p-8 text-center text-sm text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
        正在加载法签自动化工作台...
      </div>
    </div>
  ),
})

export default function FranceAutomationPage() {
  return <FranceAutomationClientPage />
}
