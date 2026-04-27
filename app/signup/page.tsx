"use client"

import dynamic from "next/dynamic"

const SignUpClientPage = dynamic(() => import("./SignUpClientPage"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-900">
        <div className="mb-6 space-y-3 text-center">
          <div className="mx-auto h-8 w-32 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
          <div className="mx-auto h-4 w-64 max-w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="space-y-5">
          {[0, 1, 2].map((item) => (
            <div key={item} className="space-y-2">
              <div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-10 animate-pulse rounded-md bg-gray-100 dark:bg-gray-800" />
            </div>
          ))}
          <div className="h-10 animate-pulse rounded-md bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>
    </div>
  ),
})

export default function SignUpPage() {
  return <SignUpClientPage />
}
