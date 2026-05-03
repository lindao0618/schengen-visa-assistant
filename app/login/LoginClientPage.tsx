"use client"

import type { FormEvent, ReactNode } from "react"
import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react"

import { ProCard } from "@/components/pro-ui/pro-card"
import { ProLogo } from "@/components/pro-ui/pro-logo"
import { ProShell } from "@/components/pro-ui/pro-shell"
import { ProStatus } from "@/components/pro-ui/pro-status"
import { Button } from "@/components/ui/button"
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
    <ProShell innerClassName="flex min-h-screen items-center pt-28">
      <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-center">
        <section className="hidden space-y-8 lg:block">
          <ProLogo href="/" />
          <div className="space-y-5">
            <ProStatus tone="info">VISTORIA 618 PRO Access</ProStatus>
            <h1 className="max-w-2xl text-5xl font-semibold tracking-tight text-white">
              签证团队的安全控制台入口。
            </h1>
            <p className="max-w-xl text-base leading-8 text-white/48">
              登录后继续处理申请人档案、材料归档、自动化任务和预约监控。账号仅限已授权团队成员使用。
            </p>
          </div>
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <FeatureCard icon={<ShieldCheck className="h-4 w-4" />} title="角色权限" text="老板、主管、专员和客服按职责访问资料。" />
            <FeatureCard icon={<LockKeyhole className="h-4 w-4" />} title="安全入口" text="敏感客户资料仅在认证后进入业务系统。" />
          </div>
        </section>

        <ProCard className="glass p-6 sm:p-8">
          <div className="mb-8 space-y-3">
            <div className="inline-flex rounded-2xl bg-white p-3 text-black">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white">用户登录</h2>
              <p className="mt-2 text-sm text-white/45">使用已分配的邮箱和密码进入 VISTORIA 618 PRO。</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/70">
                邮箱
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="输入邮箱"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                className="pro-input border-white/10 bg-white/[0.05] text-white placeholder:text-white/25 focus-visible:ring-white/30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/70">
                密码
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="输入密码"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                className="pro-input border-white/10 bg-white/[0.05] text-white placeholder:text-white/25 focus-visible:ring-white/30"
              />
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <Button className="h-12 w-full rounded-2xl bg-white text-black hover:bg-zinc-200" type="submit" disabled={loading}>
              {loading ? "登录中..." : "登录"}
              {!loading ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-white/45">
            没有账户？{" "}
            <Link href="/signup" className="font-semibold text-white hover:underline">
              注册或联系管理员开通
            </Link>
          </div>
        </ProCard>
      </div>
    </ProShell>
  )
}

function FeatureCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="glass rounded-[24px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
      <div className="mb-4 inline-flex rounded-2xl bg-white/[0.08] p-2 text-white">{icon}</div>
      <div className="font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm leading-6 text-white/45">{text}</p>
    </div>
  )
}
