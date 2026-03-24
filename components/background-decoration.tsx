"use client"

import React from 'react'

export function BackgroundDecoration() {
  return (
    <div className="absolute top-0 left-0 h-full w-full opacity-20 pointer-events-none">
      {/* 右上角装饰圆 */}
      <div className="absolute top-10 right-10 h-20 w-20 rounded-full bg-white shadow-lg blur-3xl"></div>
      
      {/* 左下角装饰圆 */}
      <div className="absolute bottom-10 left-10 h-20 w-20 rounded-full bg-white shadow-md blur-3xl"></div>
      
      {/* 中心装饰圆 */}
      <div className="absolute top-1/2 left-1/3 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-xl blur-3xl"></div>
    </div>
  )
}

// 如果你需要一个错误边界组件的话
export function RedirectErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <BackgroundDecoration />
      {children}
    </div>
  )
}
