"use client"

import dynamic from "next/dynamic"
import type { ComponentType } from "react"

type LazyToasterProps = {
  richColors?: boolean
  closeButton?: boolean
}

const DeferredToaster = dynamic<LazyToasterProps>(
  () => import("./ui/sonner").then((mod) => mod.Toaster as ComponentType<LazyToasterProps>),
  { ssr: false }
)

export function LazyToaster(props: LazyToasterProps) {
  return <DeferredToaster {...props} />
}
