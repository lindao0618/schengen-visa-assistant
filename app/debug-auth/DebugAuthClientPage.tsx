"use client"

import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { signIn, signOut } from "next-auth/react"
import { useState, useEffect } from "react"

export default function DebugAuthClientPage() {
  const { data: session, status } = useSession()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">认证调试页面</h1>
      
      <div className="space-y-4">
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-bold mb-2">组件状态</h2>
          <p><strong>组件已挂载:</strong> {mounted ? "是" : "否"}</p>
          <p><strong>认证状态:</strong> {status}</p>
          <p><strong>会话数据:</strong> {session ? "存在" : "不存在"}</p>
        </div>
        
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-bold mb-2">会话详情</h2>
          <pre className="bg-white p-2 rounded text-sm overflow-auto">
            {JSON.stringify({ status, session, mounted }, null, 2)}
          </pre>
        </div>
        
        <div className="space-x-4">
          {!session ? (
            <Button onClick={() => signIn()}>
              登录
            </Button>
          ) : (
            <Button onClick={() => signOut()}>
              退出登录
            </Button>
          )}
        </div>
        
        <div className="bg-blue-100 p-4 rounded">
          <h2 className="font-bold mb-2">测试账户</h2>
          <p><strong>邮箱:</strong> test@example.com</p>
          <p><strong>密码:</strong> password123</p>
        </div>
      </div>
    </div>
  )
}










