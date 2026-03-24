"use client"

import type React from "react"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import Link from "next/link"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { update: updateSession } = useSession()
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    
    console.log("🚀 Login attempt:", { email, password: password ? "***" : "missing" })
    
    try {
      const { signIn } = await import("next-auth/react")
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      })
      
      if (result?.error) {
        setError(result.error)
      } else {
        await updateSession()
        // 使用整页跳转确保 SessionProvider 能正确读取到新 session
        // Credentials 登录后 router.push 可能导致客户端 session 未及时更新
        window.location.href = callbackUrl
      }
    } catch (error) {
      console.error("💥 SignIn exception:", error)
      setError("登录过程中发生错误，请稍后再试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>用户登录</CardTitle>
          <CardDescription>登录到您的账户</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="输入邮箱"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            <Button className="w-full mt-4" type="submit" disabled={loading}>
              {loading ? "登录中..." : "登录"}
            </Button>
          </form>
          
          <div className="mt-4 text-center text-sm text-gray-600">
            <p>测试账号：</p>
            <p>邮箱：user@example.com</p>
            <p>密码：password123</p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href="/signup" className="text-sm text-blue-500 hover:underline">
            没有账户？注册
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}