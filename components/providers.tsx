"use client"

import { SessionProvider } from "next-auth/react"
import type React from "react"
import { getPublicUiPreviewSession } from "@/lib/public-ui-preview"

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const publicUiPreviewSession = getPublicUiPreviewSession()

  return (
    <SessionProvider
      session={publicUiPreviewSession}
      refetchOnWindowFocus={!publicUiPreviewSession}
      refetchInterval={0}
    >
      {children}
    </SessionProvider>
  )
}
