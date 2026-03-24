import type { ReactNode } from "react"
import { Plane, Info } from "lucide-react"

interface PageHeaderProps {
  title: string
  description?: string
  children?: ReactNode
  icon?: ReactNode
}

export function PageHeader({ title, description, children, icon }: PageHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-gray-100 p-8 md:p-10 mb-12" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
      {/* 背景装饰元素 - 白底风格 */}
      <div className="absolute top-0 left-0 h-full w-full opacity-8 pointer-events-none">
        <div className="absolute top-8 right-8 h-24 w-24 rounded-full bg-blue-50 blur-2xl"></div>
        <div className="absolute bottom-8 left-8 h-20 w-20 rounded-full bg-gray-50 blur-xl"></div>
        <div className="absolute top-1/2 left-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-25 blur-3xl"></div>
      </div>
      
      <div className="relative z-10 grid gap-6 md:grid-cols-[1fr_auto]">
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-600 rounded-xl shadow-sm">
              {icon || <Plane className="h-6 w-6 text-white" />}
            </div>
            <h1 className="text-2xl font-bold leading-tight text-gray-900 sm:text-3xl md:text-4xl">
              {title}
            </h1>
            <button className="ml-2 p-1.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 group" title="什么是 Slot 监控服务">
              <Info className="h-4 w-4 text-gray-500 group-hover:text-blue-600" />
            </button>
          </div>
          
          {description && (
            <p className="text-lg leading-relaxed text-gray-600 max-w-4xl font-medium">             
              {description}
            </p>
          )}
          
          {children}
        </div>
        
        <div className="hidden md:flex items-center justify-center">
          <div className="relative">
            <button 
              className="group relative h-16 w-16 flex-shrink-0 rounded-2xl border-2 border-gray-200 bg-white hover:border-blue-600 hover:bg-blue-600 transition-all duration-300 shadow-sm hover:shadow-md"
              title="快捷入口"
              aria-label="快捷入口按钮"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <Plane className="h-7 w-7 text-gray-600 group-hover:text-white transition-colors duration-300" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

