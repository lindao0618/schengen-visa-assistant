import type React from "react"

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-white via-gray-50 to-gray-100">
      {children}
    </div>
  )
}
