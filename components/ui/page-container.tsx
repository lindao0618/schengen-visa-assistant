import { cn } from "@/lib/utils"

interface PageContainerProps {
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}

export function PageContainer({
  children,
  className,
  noPadding = false,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "min-h-screen bg-black text-white pt-20",
        !noPadding && "px-4 py-12",
        className
      )}
    >
      <div className={cn("container mx-auto", !noPadding && "px-4")}>
        {children}
      </div>
    </div>
  )
}
