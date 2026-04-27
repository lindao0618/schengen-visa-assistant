"use client"

import dynamic from "next/dynamic"

const RegisterClientPage = dynamic(() => import("./RegisterClientPage"), {
  ssr: false,
  loading: () => <RegisterPageSkeleton />,
})

export default function RegisterPage() {
  return <RegisterClientPage />
}

function RegisterPageSkeleton() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4 dark:bg-gray-900">
      <div className="w-[350px] rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="mb-6 space-y-3">
          <div className="h-8 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-4 w-36 animate-pulse rounded bg-gray-100 dark:bg-gray-900" />
        </div>
        <div className="space-y-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="space-y-2">
              <div className="h-4 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-10 animate-pulse rounded-md bg-gray-100 dark:bg-gray-900" />
            </div>
          ))}
          <div className="h-10 animate-pulse rounded-md bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>
    </main>
  )
}
