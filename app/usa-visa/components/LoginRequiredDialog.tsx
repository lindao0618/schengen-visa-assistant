"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface LoginRequiredDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LoginRequiredDialog({ open, onOpenChange }: LoginRequiredDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>需要登录</DialogTitle>
          <DialogDescription>需要登录才能使用此功能</DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="outline" asChild>
            <Link href="/signup">注册</Link>
          </Button>
          <Button asChild>
            <Link href="/login?callbackUrl=/usa-visa">登录</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
