'use client'
 
import Link from 'next/link'
import { Button } from '@/components/ui/button'
 
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <h2 className="text-2xl font-bold text-white">页面未找到</h2>
      <p className="text-gray-400">抱歉，您访问的页面不存在。</p>
      <Button
        asChild
        className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
      >
        <Link href="/">
          返回首页
        </Link>
      </Button>
    </div>
  )
}
