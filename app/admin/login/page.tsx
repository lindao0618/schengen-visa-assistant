"use client"

import dynamic from "next/dynamic"

const AdminLoginClientPage = dynamic(() => import("./AdminLoginClientPage"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-3">
          <div className="mx-auto h-9 w-32 animate-pulse rounded-lg bg-gray-200" />
          <div className="mx-auto h-5 w-56 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="space-y-4">
          <div className="h-10 animate-pulse rounded-md bg-gray-200" />
          <div className="h-10 animate-pulse rounded-md bg-gray-200" />
          <div className="h-10 animate-pulse rounded-md bg-gray-200" />
        </div>
      </div>
    </div>
  ),
})

export default function AdminLoginPage() {
  return <AdminLoginClientPage />
}
