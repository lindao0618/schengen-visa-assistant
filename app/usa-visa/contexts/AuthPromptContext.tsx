"use client"

import { createContext, useContext, useState, useCallback } from "react"
import { LoginRequiredDialog } from "../components/LoginRequiredDialog"

interface AuthPromptContextValue {
  showLoginPrompt: () => void
}

const AuthPromptContext = createContext<AuthPromptContextValue | null>(null)

export function AuthPromptProvider({ children }: { children: React.ReactNode }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const showLoginPrompt = useCallback(() => setDialogOpen(true), [])

  return (
    <AuthPromptContext.Provider value={{ showLoginPrompt }}>
      {children}
      <LoginRequiredDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </AuthPromptContext.Provider>
  )
}

export function useAuthPrompt() {
  const ctx = useContext(AuthPromptContext)
  return ctx ?? { showLoginPrompt: () => {} }
}
