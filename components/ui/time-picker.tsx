"use client"

import * as React from "react"
import { Clock } from "lucide-react"
import { Label } from "./label"
import { Input } from "./input"
import { cn } from "@/lib/utils"

interface TimePickerProps {
  label?: string
  className?: string
  onChange?: (value: string) => void
  defaultValue?: string
  value?: string
}

export function TimePickerDemo({ className, label, onChange, ...props }: TimePickerProps) {
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (onChange) {
      onChange(value)
    }
  }

  return (
    <div className={cn("grid gap-2", className)}>
      {label && <Label>{label}</Label>}
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 opacity-70" />
        <Input
          type="time"
          onChange={handleTimeChange}
          className="w-full"
          {...props}
        />
      </div>
    </div>
  )
}
