'use client'
 
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
 
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])
 
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <h2 className="text-2xl font-bold text-red-500">出错了</h2>
      <p className="text-gray-400">抱歉，加载过程中出现了错误。</p>
      <Button
        onClick={reset}
        className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
      >
        重试
      </Button>
    </div>
  )
}
