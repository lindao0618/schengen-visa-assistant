"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "./button"
import { Input } from "./input"
import { Label } from "./label"

interface AuthFormProps {
  type: "login" | "register"
  onSubmit: (data: { email: string; password: string }) => void
}

export function AuthForm({ type, onSubmit }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ email, password })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">邮箱</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="password">密码</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full">
        {type === 'login' ? '登录' : '注册'}
      </Button>
    </form>
  )
}
