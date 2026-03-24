"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, CheckCircle, AlertCircle, Image as ImageIcon, Ruler, FileText } from "lucide-react"
import Image from "next/image"

interface PhotoCheckResult {
  success: boolean
  message: string
  dimensions?: {
    width: number
    height: number
  }
  width?: number
  height?: number
  file_size?: number
  ai_suggestion?: string
}

export function PhotoChecker() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PhotoCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // 重置函数，清除当前照片和结果，准备上传新照片
  const resetPhoto = () => {
    setFile(null)
    setPreview("")
    setResult(null)
    setError(null) // 重置错误状态
    // 如果用户之前上传了照片，需要释放URL对象
    if (preview) {
      URL.revokeObjectURL(preview)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFile(file)
      setPreview(URL.createObjectURL(file))
      setResult(null)
      setError(null) // 重置错误状态
    }
  }

  const checkPhoto = async () => {
    if (!file) return
    setLoading(true)
    setError(null) // 开始新的检测前清除错误
    
    try {
      // 检查文件类型和大小
      if (!file.type.startsWith('image/')) {
        throw new Error('请上传有效的图片文件')
      }
      
      // 检查文件大小不超过5MB
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('照片文件大小不能超过5MB')
      }
      
      const formData = new FormData()
      formData.append("photo", file)
      
      // 使用我们的后端API代理处理请求
      const response = await fetch("/api/usa-visa/photo-check", {
        method: "POST",
        body: formData,
      })
      
      if (!response.ok) {
        // 处理HTTP错误状态码
        const errorText = await response.text().catch(() => '服务器响应错误')
        throw new Error(`请求失败 (${response.status}): ${errorText}`)
      }
      
      const data = await response.json()
      setResult(data)
    } catch (error) {
      console.error("照片检测错误:", error)
      
      // 设置错误状态而不是错误结果
      setError(error instanceof Error ? error.message : '照片检测过程中发生未知错误')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 错误显示区域 */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-2">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <h3 className="font-medium text-red-400">检测过程中出现错误</h3>
              <p className="text-gray-300 text-sm">{error}</p>
              <Button 
                onClick={resetPhoto} 
                className="mt-2 bg-red-600 hover:bg-red-700 text-white h-9 px-3 py-1 text-sm"
              >
                重新上传照片
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* 上传区域 - 苹果风格黑白渐变 */}
      <div className="bg-gradient-to-b from-gray-50 to-gray-100 p-4 rounded-lg shadow-md dark:from-gray-900 dark:to-black">
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-gray-400 transition-all duration-300 backdrop-blur-md bg-white/80 dark:border-gray-700/50 dark:hover:border-white/60 dark:bg-white/5">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            id="photo-upload"
          />
          <label
            htmlFor="photo-upload"
            className="flex flex-col items-center cursor-pointer w-full"
          >
            {preview ? (
              <div className="relative w-32 h-40 border-4 border-dashed border-gray-300 dark:border-white/30 flex items-center justify-center overflow-hidden">
                <Image 
                  src={preview} 
                  alt="上传的照片" 
                  fill
                  style={{ objectFit: 'cover' }}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-48 bg-gray-100 rounded-md transition-all hover:bg-gray-200 dark:bg-black/20 dark:hover:bg-white/5">
                <Upload className="h-16 w-16 text-gray-500 dark:text-white mb-4 animate-pulse" />
                <p className="text-gray-800 dark:text-white text-base font-medium">点击或拖拽上传美签照片</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-2 max-w-xs text-center">上传您的照片，我们将自动检测是否符合美签要求</p>
              </div>
            )}
          </label>
        </div>
      </div>

      {/* 检测按钮 - 苹果风格黑白设计 */}
      {file && !result && (
        <Button
          onClick={checkPhoto}
          disabled={loading || !!error}
          className="w-full py-3 bg-gray-900 hover:bg-black text-white text-lg font-medium shadow-lg rounded-md transition-all duration-200 hover:shadow-xl border border-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 dark:border-gray-200"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent dark:border-black dark:border-t-transparent"></div>
              <span>正在检测中...</span>
            </div>
          ) : (
            <span>开始智能检测</span>
          )}
        </Button>
      )}

      {/* 结果展示区域 - 苹果风格黑白渐变 */}
      {result && (
        <div className="mt-2">
          <Card className={`p-6 backdrop-blur-md shadow-xl border ${result.success ? "bg-gradient-to-b from-white to-gray-100 border-gray-200 dark:from-gray-900 dark:to-black dark:border-white/20" : "bg-gradient-to-b from-white to-gray-100 border-gray-200 dark:from-gray-900 dark:to-black dark:border-gray-700/50"}`}>
            <div className="space-y-5">
              <div className="flex items-center gap-3 border-b border-gray-200 pb-4 dark:border-white/10">
                {result.success ? (
                  <div className="bg-gray-100 p-2 rounded-full dark:bg-white/10">
                    <CheckCircle className="h-7 w-7 text-gray-900 dark:text-white" />
                  </div>
                ) : (
                  <div className="bg-gray-100 p-2 rounded-full dark:bg-white/10">
                    <AlertCircle className="h-7 w-7 text-gray-900 dark:text-white" />
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {result.success ? "照片符合要求" : "照片不符合要求"}
                  </h3>
                  <p className="text-gray-600 text-sm dark:text-gray-400">
                    {result.success 
                      ? "恭喜！您的照片满足美国签证照片规格要求" 
                      : "请根据以下建议调整您的照片"}
                  </p>
                </div>
              </div>
              
              <div className="grid gap-4 text-sm bg-gray-50 rounded-lg p-4 dark:bg-black/15">
                <div className="flex flex-col md:flex-row md:items-center gap-2">
                  <div className="flex items-center gap-2 min-w-32">
                    <ImageIcon className="h-5 w-5 text-gray-800 dark:text-white" />
                    <span className="text-gray-800 font-medium dark:text-white">提示信息</span>
                  </div>
                  <span className="text-gray-700 ml-7 md:ml-0 dark:text-gray-300">{result.message}</span>
                </div>
                
                {result.dimensions && (
                  <div className="flex flex-col md:flex-row md:items-center gap-2">
                    <div className="flex items-center gap-2 min-w-32">
                      <Ruler className="h-5 w-5 text-gray-800 dark:text-white" />
                      <span className="text-gray-800 font-medium dark:text-white">照片尺寸</span>
                    </div>
                    <span className="text-gray-700 ml-7 md:ml-0 dark:text-gray-300">{result.dimensions.width} x {result.dimensions.height} 像素</span>
                  </div>
                )}
                
                {result.file_size !== undefined && (
                  <div className="flex flex-col md:flex-row md:items-center gap-2">
                    <div className="flex items-center gap-2 min-w-32">
                      <FileText className="h-5 w-5 text-gray-800 dark:text-white" />
                      <span className="text-gray-800 font-medium dark:text-white">文件大小</span>
                    </div>
                    <span className="text-gray-700 ml-7 md:ml-0 dark:text-gray-300">{result.file_size.toFixed(2)} KB</span>
                  </div>
                )}
              </div>
              
              {result.ai_suggestion && (
                <div className="flex flex-col gap-3 bg-gradient-to-b from-gray-100 to-white p-4 rounded-lg border border-gray-200 shadow-inner dark:from-gray-800 dark:to-black dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="bg-gray-200 p-1.5 rounded-full dark:bg-white/10">
                      <CheckCircle className="h-5 w-5 text-gray-800 dark:text-white" />
                    </div>
                    <span className="text-gray-800 font-medium text-base dark:text-white">AI智能建议</span>
                  </div>
                  <p className="text-gray-700 ml-10 leading-relaxed text-sm dark:text-gray-300">{result.ai_suggestion}</p>
                </div>
              )}
              
              <div className="flex justify-center mt-4">
                <Button 
                  onClick={resetPhoto} 
                  className="bg-gray-800 hover:bg-black text-white shadow-sm border border-gray-700 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 dark:border-gray-200"
                >
                  {result.success ? "重新上传" : "重新上传照片"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
