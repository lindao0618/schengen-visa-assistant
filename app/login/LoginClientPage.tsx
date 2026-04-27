"use client"

import type { FormEvent, ReactNode } from "react"
import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginClientPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const { update: updateSession } = useSession()
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      const { signIn } = await import("next-auth/react")
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      })

      if (result?.error) {
        setError(result.error)
        return
      }

      await updateSession()
      // Credentials 登录后 router.push 可能导致客户端 session 未及时更新，这里保留整页跳转。
      window.location.href = callbackUrl
    } catch {
      setError("登录过程中发生错误，请稍后再试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_34rem),radial-gradient(circle_at_bottom_right,_#dcfce7,_transparent_30rem),linear-gradient(135deg,_#f8fafc,_#ffffff)] px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-center">
          <section className="hidden space-y-6 lg:block">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/75 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm backdrop-blur">
              Vistoria Visa Workspace
            </div>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-5xl font-semibold tracking-tight text-slate-950">
                签证团队的案件、材料和自动化工作台。
              </h1>
              <p className="max-w-xl text-base leading-7 text-slate-600">
                登录后可继续处理申请人档案、Case 分配、材料归档和自动化任务。账号仅限已授权团队成员使用。
              </p>
            </div>
            <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
              <FeatureCard icon={<ShieldCheck className="h-4 w-4" />} title="角色权限" text="老板、主管、专员、客服按职责访问资料。" />
              <FeatureCard icon={<LockKeyhole className="h-4 w-4" />} title="安全入口" text="敏感客户资料仅在认证后进入业务系统。" />
            </div>
          </section>

          <Card className="border-slate-200 bg-white/90 shadow-xl shadow-slate-200/60 backdrop-blur">
            <CardContent className="p-6">
              <div className="mb-7 space-y-2">
                <div className="inline-flex rounded-2xl bg-slate-950 p-3 text-white">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">用户登录</h2>
                <p className="text-sm text-slate-500">使用已分配的邮箱和密码进入系统。</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">邮箱</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="输入邮箱"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="输入密码"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>

                {error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                <Button className="h-11 w-full" type="submit" disabled={loading}>
                  {loading ? "登录中..." : "登录"}
                  {!loading ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
                </Button>
              </form>

              <div className="mt-5 text-center text-sm text-slate-500">
                没有账户？{" "}
                <Link href="/signup" className="font-medium text-slate-950 hover:underline">
                  注册或联系管理员开通
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: ReactNode
  title: string
  text: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur">
      <div className="mb-3 inline-flex rounded-xl bg-slate-100 p-2 text-slate-700">{icon}</div>
      <div className="font-semibold text-slate-950">{title}</div>
      <p className="mt-1 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  )
}
