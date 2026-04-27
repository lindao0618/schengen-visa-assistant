"use client"

import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminTestAuthClientPage() {
  const { data: session, status } = useSession()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>认证状态测试</CardTitle>
            <CardDescription>
              检查NextAuth.js认证是否正常工作
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium">状态:</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {status}
              </p>
            </div>
            
            {session ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">用户信息:</h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <p>ID: {session.user?.id || "未设置"}</p>
                    <p>邮箱: {session.user?.email || "未设置"}</p>
                    <p>姓名: {session.user?.name || "未设置"}</p>
                    <p>角色: {session.user?.role || "未设置"}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium">完整Session对象:</h3>
                  <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto">
                    {JSON.stringify(session, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="font-medium">未登录</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  请先登录以查看用户信息
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}










