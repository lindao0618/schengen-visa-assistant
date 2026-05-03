"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, CheckCircle2, Fingerprint, ShieldCheck } from "lucide-react"

import { ProCard } from "@/components/pro-ui/pro-card"
import { ProLogo } from "@/components/pro-ui/pro-logo"
import { ProShell } from "@/components/pro-ui/pro-shell"
import { ProStatus } from "@/components/pro-ui/pro-status"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function RegisterClientPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!name || !email || !password || !confirmPassword) {
      setError("请填写所有字段")
      return
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致")
      return
    }
    setLoading(true)
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await response.json()
      if (response.ok) {
        alert("注册成功！请登录。")
        router.push("/login")
      } else {
        setError(data.error || "注册失败")
      }
    } catch (err) {
      setError("注册过程中发生错误，请稍后再试")
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
            <ProStatus tone="online">VISTORIA 618 PRO Registry</ProStatus>
            <h1 className="max-w-2xl text-5xl font-semibold tracking-tight text-white">
              创建你的签证自动化身份。
            </h1>
            <p className="max-w-xl text-base leading-8 text-white/48">
              账户用于保存签证任务、申请材料、自动化进度和 AI 咨询上下文。
            </p>
          </div>
          <div className="grid max-w-2xl gap-4 sm:grid-cols-3">
            {[
              { icon: Fingerprint, label: "Secure ID" },
              { icon: ShieldCheck, label: "Protected Docs" },
              { icon: CheckCircle2, label: "Workflow Ready" },
            ].map((item) => (
              <div key={item.label} className="glass rounded-[24px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
                <item.icon className="mb-6 h-5 w-5 text-blue-300" />
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/38">{item.label}</div>
              </div>
            ))}
          </div>
        </section>

        <ProCard className="glass p-6 sm:p-8">
          <div className="mb-8">
            <div className="mb-4 inline-flex rounded-2xl bg-white p-3 text-black">
              <Fingerprint className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">注册</h2>
            <p className="mt-2 text-sm text-white/45">创建一个新账户，进入 VISTORIA 618 PRO 工作台。</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="姓名" id="name">
              <Input
                id="name"
                placeholder="输入姓名"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="pro-input border-white/10 bg-white/[0.05] text-white placeholder:text-white/25 focus-visible:ring-white/30"
              />
            </Field>
            <Field label="邮箱" id="email">
              <Input
                id="email"
                type="email"
                placeholder="输入邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="pro-input border-white/10 bg-white/[0.05] text-white placeholder:text-white/25 focus-visible:ring-white/30"
              />
            </Field>
            <Field label="密码" id="password">
              <Input
                id="password"
                type="password"
                placeholder="输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                className="pro-input border-white/10 bg-white/[0.05] text-white placeholder:text-white/25 focus-visible:ring-white/30"
              />
            </Field>
            <Field label="确认密码" id="confirmPassword">
              <Input
                id="confirmPassword"
                type="password"
                placeholder="再次输入密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                className="pro-input border-white/10 bg-white/[0.05] text-white placeholder:text-white/25 focus-visible:ring-white/30"
              />
            </Field>

            {error ? (
              <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <Button className="h-12 w-full rounded-2xl bg-white text-black hover:bg-zinc-200" type="submit" disabled={loading}>
              {loading ? "注册中..." : "注册"}
              {!loading ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-white/45">
            已有账户？{" "}
            <Link href="/login" className="font-semibold text-white hover:underline">
              登录
            </Link>
          </div>
        </ProCard>
      </div>
    </ProShell>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-white/70">
        {label}
      </Label>
      {children}
    </div>
  )
}
