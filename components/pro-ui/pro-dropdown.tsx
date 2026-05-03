"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle2, ChevronDown, UserPlus, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type ProDropdownOption = {
  value: string
  label: string
  meta?: string
  badge?: string
  iconLabel?: string
  icon?: LucideIcon
  tone?: "blue" | "emerald" | "amber" | "purple" | "orange"
}

type ProDropdownProps = {
  label: string
  value: string
  options: ProDropdownOption[]
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  triggerClassName?: string
  disabled?: boolean
  theme?: "dark" | "light"
}

const toneClasses = {
  blue: "from-blue-400 to-indigo-500",
  emerald: "from-emerald-400 to-teal-500",
  amber: "from-amber-400 to-orange-500",
  purple: "from-purple-400 to-pink-500",
  orange: "from-orange-400 to-red-500",
}

function useOutsideClose(open: boolean, onClose: () => void) {
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose()
    }

    window.addEventListener("pointerdown", handlePointerDown)
    return () => window.removeEventListener("pointerdown", handlePointerDown)
  }, [open, onClose])

  return rootRef
}

function OptionMark({ option }: { option: ProDropdownOption }) {
  const Icon = option.icon
  const tone = option.tone || "blue"

  if (Icon) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white shadow-inner">
        <Icon className="h-4 w-4" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b text-xs font-bold text-white shadow-inner",
        toneClasses[tone],
      )}
    >
      {option.iconLabel || option.label.slice(0, 2).toUpperCase()}
    </div>
  )
}

export function ProDropdown({
  label,
  value,
  options,
  onChange,
  placeholder = "请选择",
  className,
  triggerClassName,
  disabled = false,
  theme = "dark",
}: ProDropdownProps) {
  const [openDropdown, setOpenDropdown] = useState(false)
  const rootRef = useOutsideClose(openDropdown, () => setOpenDropdown(false))
  const selected = options.find((option) => option.value === value)
  const isDark = theme === "dark"

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <span
        className={cn(
          "mb-2 block text-[11px] font-bold uppercase tracking-wider transition-colors",
          isDark ? "text-white/40" : "text-gray-400",
        )}
      >
        {label}
      </span>
      <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpenDropdown((current) => !current)}
        className="group w-full cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div
          className={cn(
            "flex min-h-[64px] items-center justify-between rounded-2xl border p-2.5 transition-all duration-300",
            openDropdown
              ? isDark
                ? "border-blue-500 bg-white/5 ring-2 ring-blue-500/20"
                : "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20"
              : isDark
                ? "border-white/10 bg-[#1a1a1c] shadow-sm hover:border-white/20 hover:shadow-[0_0_28px_rgba(59,130,246,0.10)]"
                : "border-gray-200 bg-white shadow-sm hover:border-blue-300 hover:shadow-lg",
            triggerClassName,
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            {selected ? <OptionMark option={selected} /> : null}
            <div className="min-w-0">
              <div
                className={cn(
                  "truncate text-sm font-bold leading-none transition-colors",
                  selected ? "mb-1" : "",
                  isDark ? "text-white group-hover:text-blue-100" : "text-gray-900 group-hover:text-blue-900",
                )}
              >
                {selected?.label || placeholder}
              </div>
              {selected?.meta ? <div className="truncate text-[10px] leading-none text-gray-400">{selected.meta}</div> : null}
            </div>
          </div>

          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
              openDropdown
                ? isDark
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-blue-100 text-blue-600"
                : isDark
                  ? "bg-white/5 text-white/50 group-hover:text-white"
                  : "bg-gray-50 text-gray-400 group-hover:text-blue-500",
            )}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-300", openDropdown && "rotate-180")} />
          </div>
        </div>
      </button>

      <AnimatePresence>
        {openDropdown && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl",
              isDark ? "border-white/10 bg-[#151518]/90 shadow-black" : "border-gray-200 bg-white/90",
            )}
          >
            <div className="space-y-1 p-2">
              {options.map((option) => {
                const selectedOption = option.value === value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value)
                      setOpenDropdown(false)
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-xl p-3 text-left transition-colors",
                      selectedOption
                        ? isDark
                          ? "bg-white/5 hover:bg-white/10"
                          : "bg-blue-50/50 hover:bg-blue-50"
                        : isDark
                          ? "hover:bg-white/5"
                          : "hover:bg-gray-50",
                    )}
                  >
                    <OptionMark option={option} />
                    <div className="min-w-0 flex-1">
                      <div className={cn("truncate text-sm font-bold leading-none", isDark ? "text-white/85" : "text-gray-700")}>
                        {option.label}
                        {option.badge ? (
                          <span className="ml-2 rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[9px] text-blue-300">
                            {option.badge}
                          </span>
                        ) : null}
                      </div>
                      {option.meta ? (
                        <div className={cn("mt-1 text-[10px] leading-none", isDark ? "text-white/40" : "text-gray-500")}>
                          {option.meta}
                        </div>
                      ) : null}
                    </div>
                    {selectedOption ? <CheckCircle2 className="h-4 w-4 text-blue-400" /> : null}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  )
}

export type ProApplicantOption = {
  id: string
  name: string
  meta: string
  initials: string
  tone?: ProDropdownOption["tone"]
  current?: boolean
  online?: boolean
}

type ProApplicantDropdownProps = {
  label?: string
  addLabel?: string
  value: string
  options: ProApplicantOption[]
  onChange?: (value: string) => void
  onAdd?: () => void
  className?: string
}

export function ProApplicantDropdown({
  label = "Target Applicant",
  addLabel = "Add New Applicant",
  value,
  options,
  onChange,
  onAdd,
  className,
}: ProApplicantDropdownProps) {
  const [openDropdown, setOpenDropdown] = useState(false)
  const rootRef = useOutsideClose(openDropdown, () => setOpenDropdown(false))
  const selected = options.find((option) => option.id === value) || options[0]

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-white/40 transition-colors">
        {label}
      </span>
      <div className="relative">
      <button type="button" onClick={() => setOpenDropdown((current) => !current)} className="group w-full text-left">
        <div
          className={cn(
            "flex min-h-[64px] items-center justify-between rounded-2xl border p-2.5 transition-all duration-300",
            openDropdown
              ? "border-blue-500 bg-white/5 ring-2 ring-blue-500/20"
              : "border-white/10 bg-[#1a1a1c] shadow-sm hover:border-white/20 hover:shadow-[0_0_28px_rgba(59,130,246,0.10)]",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b text-xs font-bold text-white shadow-inner",
                toneClasses[selected?.tone || "blue"],
              )}
            >
              {selected?.initials || "NA"}
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#1a1a1c] bg-emerald-500" />
            </div>
            <div className="min-w-0">
              <div className="mb-1 truncate text-sm font-bold leading-none text-white transition-colors group-hover:text-blue-100">
                {selected?.name || "未绑定申请人"}
              </div>
              <div className="truncate text-[10px] leading-none text-gray-400">{selected?.meta || "No context"}</div>
            </div>
          </div>

          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
              openDropdown ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-white/50 group-hover:text-white",
            )}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-300", openDropdown && "rotate-180")} />
          </div>
        </div>
      </button>

      <AnimatePresence>
        {openDropdown && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border border-white/10 bg-[#151518]/90 shadow-2xl shadow-black backdrop-blur-xl"
          >
            <div className="space-y-1 p-2">
              {options.map((option) => {
                const selectedOption = option.id === value
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onChange?.(option.id)
                      setOpenDropdown(false)
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-xl p-3 text-left transition-colors",
                      selectedOption ? "bg-white/5 hover:bg-white/10" : "hover:bg-white/5",
                    )}
                  >
                    <div
                      className={cn(
                        "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b text-xs font-bold text-white",
                        toneClasses[option.tone || "blue"],
                      )}
                    >
                      {option.initials}
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#151518]",
                          option.online ? "bg-emerald-500" : "bg-slate-500",
                        )}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold leading-none text-white/85">
                        {option.name}
                        {option.current ? (
                          <span className="ml-2 rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[9px] text-blue-300">
                            Current
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 truncate text-[10px] leading-none text-white/40">{option.meta}</div>
                    </div>
                    {selectedOption ? <CheckCircle2 className="h-4 w-4 text-blue-400" /> : null}
                  </button>
                )
              })}

              <div className="my-1 h-px bg-white/10" />

              <button
                type="button"
                onClick={() => {
                  onAdd?.()
                  setOpenDropdown(false)
                }}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl p-2 text-white/50 transition-colors hover:bg-white/5 hover:text-white"
              >
                <UserPlus className="h-4 w-4" />
                <span className="text-xs font-medium">{addLabel}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  )
}
