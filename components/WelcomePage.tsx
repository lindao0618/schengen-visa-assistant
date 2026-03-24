"use client"

import { useState } from "react"
import { ArrowRight } from "lucide-react"

interface WelcomePageProps {
  onStart: () => void
}

export function WelcomePage({ onStart }: WelcomePageProps) {
  const [name, setName] = useState("")

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-6">欢迎使用申根签证助手</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8 text-center max-w-md">
        这个应用程序将帮助您了解申根签证申请流程，回答您的问题，并提供有用的建议。
      </p>
      <input
        type="text"
        placeholder="请输入您的名字（可选）"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full max-w-xs p-2 mb-4 border rounded dark:bg-gray-800 dark:text-white"
      />
      <button
        onClick={onStart}
        className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 transition-colors flex items-center"
      >
        开始使用 <ArrowRight className="ml-2" size={18} />
      </button>
    </div>
  )
}

