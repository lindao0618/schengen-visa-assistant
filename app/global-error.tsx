'use client'
 
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
 
export default function GlobalError({
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
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen space-y-4 bg-black text-white">
          <h2 className="text-2xl font-bold text-red-500">系统错误</h2>
          <p className="text-gray-400">抱歉，系统发生了错误。</p>
          <Button
            onClick={reset}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
          >
            重试
          </Button>
        </div>
      </body>
    </html>
  )
}
