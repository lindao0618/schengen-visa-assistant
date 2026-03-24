"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, CheckCircle, XCircle, ImageIcon, Ruler, FileText } from "lucide-react"
import Image from "next/image"

interface PhotoCheckResult {
  success: boolean
  message: string
  dimensions?: {
    width: number
    height: number
  }
  file_size?: number
  ai_suggestion?: string
}

export function PhotoChecker() {
  // 状态管理
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PhotoCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState<string>("")
  const [isEmailValid, setIsEmailValid] = useState(false)

  // 邮箱验证
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }
  
  // 重置函数，清除当前照片和结果，准备上传新照片
  // 重置所有状态
  const resetPhoto = () => {
    setFile(null)
    setPreview("")
    setResult(null)
    setError(null)
    setEmail("")
    setIsEmailValid(false)
    // 如果用户之前上传了照片，需要释放URL对象
    if (preview) {
      URL.revokeObjectURL(preview)
    }
  }

  // 处理文件上传
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    // 检查文件类型
    if (!selectedFile.type.startsWith('image/')) {
      setError('请上传图片文件')
      return
    }

    // 检查文件格式
    if (!['image/jpeg', 'image/jpg'].includes(selectedFile.type)) {
      setError('请上传JPG格式的照片')
      return
    }

    // 创建预览URL
    const previewUrl = URL.createObjectURL(selectedFile)
    setPreview(previewUrl)
    setFile(selectedFile)
    setError(null)
  }

  // 检查照片
  const checkPhoto = async () => {
    if (!file || !email || !isEmailValid) {
      setError("请上传照片并输入有效的邮箱地址")
      return
    }
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      if (file) {
        formData.append("photo", file)
        formData.append("email", email)
        
        const response = await fetch("http://43.165.7.132:8000/submit_form/", {
          method: "POST",
          body: formData,
        })

        const data = await response.json()
        
        if (response.ok) {
          setResult(data)
        } else {
          setError(data.message || "照片检查失败，请重试")
        }
      }
    } catch (err) {
      setError("服务器连接失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">美签照片检查</h2>
        <p className="text-gray-600 mb-4">
          上传您的照片，我们将检查是否符合美签照片要求
        </p>
      </div>

      {/* 邮箱输入部分 */}
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          电子邮箱
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setIsEmailValid(validateEmail(e.target.value))
          }}
          className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="请输入您的电子邮箱"
        />
        {email && !isEmailValid && (
          <p className="text-red-500 text-sm">请输入有效的电子邮箱地址</p>
        )}
      </div>

      {/* 上传部分 */}
      <div className="space-y-4">
        <div className="flex items-center justify-center w-full">
          <label
            htmlFor="dropzone-file"
            className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
          >
            {preview ? (
              <div className="relative w-full h-full">
                <Image
                  src={preview}
                  alt="预览图"
                  fill
                  unoptimized
                  sizes="100vw"
                  className="object-contain p-2"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg
                  className="w-10 h-10 mb-3 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">点击上传</span> 或拖拽文件到这里
                </p>
                <p className="text-xs text-gray-500">仅支持JPG格式照片</p>
              </div>
            )}
            <input
              id="dropzone-file"
              type="file"
              className="hidden"
              accept="image/jpeg,image/jpg"
              onChange={handleFileChange}
            />
          </label>
        </div>

        {/* 检查按钮 */}
        <button
          onClick={checkPhoto}
          disabled={!file || !isEmailValid || loading}
          className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
            !file || !isEmailValid || loading
              ? 'bg-blue-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? '检查中...' : '开始检查'}
        </button>
      </div>

      {/* 检查结果显示 */}
      {result && (
        <div
          className={`p-4 rounded-lg ${result.success ? 'bg-green-100' : 'bg-red-100'}`}
        >
          <div className="flex items-center">
            {result.success ? (
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500 mr-2" />
            )}
            <p
              className={`text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}
            >
              {result.message}
            </p>
          </div>
          {result.dimensions && (
            <div className="mt-2 text-sm text-gray-600">
              尺寸: {result.dimensions.width} x {result.dimensions.height} 像素
            </div>
          )}
        </div>
      )}
    </div>
  )
}
