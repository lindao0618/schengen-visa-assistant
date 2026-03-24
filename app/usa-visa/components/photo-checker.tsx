"use client"

import { useState, useCallback } from "react"
import { useAuthPrompt } from "../contexts/AuthPromptContext"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, CheckCircle, AlertCircle, Image as ImageIcon, Ruler, FileText, Camera, PaintBucket } from "lucide-react"
import Image from "next/image"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"

interface PhotoCheckResult {
  success: boolean
  message: string
  dimensions?: { width: number; height: number }
  width?: number
  height?: number
  file_size?: number
  checks?: string[]
  suggestion?: string
  processed_photo_download_url?: string
  processed_photo_file?: string
  background_color?: { isWhite: boolean; confidence: number; rgb?: string }
  face_detection?: { found: boolean; centered: boolean; rotation: number; eyesOpen: boolean }
}

export function PhotoChecker() {
  const { showLoginPrompt } = useAuthPrompt()
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<PhotoCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [imageScale, setImageScale] = useState<number[]>([100])
  const [analyzing, setAnalyzing] = useState(false)

  const resetPhoto = () => {
    previews.forEach((url) => URL.revokeObjectURL(url))
    setFiles([])
    setPreviews([])
    setResult(null)
    setError(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files
    if (selected?.length) {
      const arr = Array.from(selected).filter((f) => f.type.startsWith('image/'))
      if (arr.length !== selected.length) {
        setError('部分文件非图片格式，已过滤')
      } else {
        setError(null)
      }
      setFiles((prev) => [...prev, ...arr])
      setPreviews((prev) => [...prev, ...arr.map((f) => URL.createObjectURL(f))])
      setResult(null)
    }
    e.target.value = ''
  }

  const checkPhoto = useCallback(async () => {
    if (files.length === 0) return

    setLoading(true)
    setError(null)
    setAnalyzing(true)
    setProgress(0)

    const validFiles = files.filter((f) => {
      if (!f.type.startsWith('image/')) return false
      if (f.size > 5 * 1024 * 1024) return false
      return true
    })
    if (validFiles.length === 0) {
      setError('请上传有效的图片文件（单张不超过5MB）')
      setLoading(false)
      setAnalyzing(false)
      return
    }
    if (validFiles.length !== files.length) {
      setError('部分文件过大或格式无效，已跳过')
    }

    let completed = 0
    const total = validFiles.length

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]
      try {
        const formData = new FormData()
        formData.append('photo', file)
        formData.append('scale', imageScale[0].toString())
        formData.append('useWebsite', 'true')  // 默认启用 CEAC 官网检测
        formData.append('async', 'true')

        const data = await new Promise<PhotoCheckResult>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
              const pct = Math.round((ev.loaded / ev.total) * 100)
              setProgress(Math.round(((completed + pct / 100) / total) * 100))
            }
          }
          xhr.onload = () => {
            if (xhr.status === 401) {
              showLoginPrompt()
              reject(new Error('AUTH_REQUIRED'))
              return
            }
            if (xhr.status === 200) {
              try {
                const resp = JSON.parse(xhr.responseText)
                if (resp.task_id) {
                  resolve({
                    success: true,
                    message:
                      total > 1
                        ? `已提交 ${total} 个检测任务，请查看下方任务列表`
                        : '检测已提交，请查看下方任务列表的进度和结果',
                  })
                } else {
                  resolve(resp as PhotoCheckResult)
                }
              } catch {
                reject(new Error('服务器返回的数据格式错误'))
              }
            } else {
              reject(new Error(`请求失败 (${xhr.status})`))
            }
          }
          xhr.onerror = () => reject(new Error('网络错误'))
          xhr.open('POST', '/api/usa-visa/photo-check')
          xhr.send(formData)
        })
        setResult(data)
      } catch (err) {
        if (err instanceof Error && err.message === 'AUTH_REQUIRED') return
        setError(err instanceof Error ? err.message : '照片检测过程中发生未知错误')
        setResult(null)
      }
      completed += 1
      setProgress(Math.round((completed / total) * 100))
    }

    setLoading(false)
    setAnalyzing(false)
    setProgress(100)
  }, [files, imageScale, showLoginPrompt])

  return (
    <div className="space-y-6">
      {/* 照片规格说明 */}
      <Card className="p-4 bg-blue-50/10 border-blue-200/20">
        <h3 className="font-medium text-blue-600 dark:text-blue-400 mb-2">美签照片要求说明</h3>
        <ul className="text-sm space-y-2 text-gray-600 dark:text-gray-300">
          <li>• 照片尺寸：2x2英寸（51x51毫米）</li>
          <li>• 头部尺寸：1英寸至1 3/8英寸（25-35毫米）</li>
          <li>• 白色或灰白色背景</li>
          <li>• 正面面对相机，表情自然</li>
          <li>• 眼睛睁开且清晰可见</li>
          <li>• 不允许佩戴眼镜</li>
          <li>• 照片必须是最近6个月内拍摄</li>
        </ul>
      </Card>
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
      
      {/* 上传区域 - 支持批量 */}
      <div className="bg-gradient-to-b from-white to-[#f2f2f7] p-4 rounded-lg shadow-sm border border-[#e5e5ea] dark:from-gray-900 dark:to-black">
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-[#d1d1d6] rounded-lg p-6 hover:border-[#8e8e93] transition-all duration-300 backdrop-blur-md bg-white/90 dark:border-gray-700/50 dark:hover:border-white/60 dark:bg-white/5">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
            id="photo-upload"
          />
          <label
            htmlFor="photo-upload"
            className="flex flex-col items-center cursor-pointer w-full"
          >
            {loading && (
              <Card className="p-4 w-full max-w-md">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {analyzing ? '正在提交检测...' : '正在上传...'}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {progress}%
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              </Card>
            )}
            {previews.length > 0 && (
              <Card className="mt-4 overflow-hidden w-full max-w-2xl">
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <Label htmlFor="scale" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      照片缩放: {imageScale[0]}% · 已选 {files.length} 张照片
                    </Label>
                    <Slider
                      id="scale"
                      min={50}
                      max={150}
                      step={1}
                      value={imageScale}
                      onValueChange={setImageScale}
                      className="mt-2"
                    />
                  </div>
                  <label
                    htmlFor="photo-upload"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-black/30 dark:hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    添加更多
                  </label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-4">
                  {previews.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded overflow-hidden border border-gray-200 dark:border-gray-700">
                      <Image
                        src={url}
                        alt={`预览 ${i + 1}`}
                        fill
                        className="object-cover"
                        style={{ transform: `scale(${imageScale[0] / 100})` }}
                      />
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {previews.length === 0 && (
              <div className="flex flex-col items-center justify-center w-full h-48 bg-gray-100 rounded-md transition-all hover:bg-gray-200 dark:bg-black/20 dark:hover:bg-white/5">
                <Upload className="h-16 w-16 text-gray-500 dark:text-white mb-4 animate-pulse" />
                <p className="text-gray-800 dark:text-white text-base font-medium">点击或拖拽上传美签照片（支持批量）</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-2 max-w-xs text-center">支持多选，默认启用 CEAC 官网检测</p>
              </div>
            )}
          </label>
        </div>
      </div>

      {/* 检测按钮 */}
      {files.length > 0 && !result && (
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
            <span>开始智能检测{files.length > 1 ? ` (${files.length} 张)` : ''}</span>
          )}
        </Button>
      )}

      {/* 结果展示区域 - 苹果风格黑白渐变 */}
      {result && (
        <div className="mt-2">
          {result.background_color && (
            <div className="mb-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50">
              <div className="flex items-center gap-2 mb-2">
                <PaintBucket className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <h3 className="font-medium text-gray-900 dark:text-white">背景检测</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">背景颜色是否合格</span>
                  <span className={`text-sm font-medium ${result.background_color.isWhite ? 'text-green-600' : 'text-red-600'}`}>
                    {result.background_color.isWhite ? '合格' : '不合格'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">置信度</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {Math.round(result.background_color.confidence * 100)}%
                  </span>
                </div>
                {result.background_color.rgb && (
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-6 h-6 rounded border border-gray-200 dark:border-gray-700" 
                      style={{ backgroundColor: result.background_color.rgb }}
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {result.background_color.rgb}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          {result.face_detection && (
            <div className="mb-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50">
              <div className="flex items-center gap-2 mb-2">
                <Camera className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <h3 className="font-medium text-gray-900 dark:text-white">人脸检测</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">是否检测到人脸</span>
                  <span className={`text-sm font-medium ${result.face_detection.found ? 'text-green-600' : 'text-red-600'}`}>
                    {result.face_detection.found ? '是' : '否'}
                  </span>
                </div>
                {result.face_detection.found && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">人脸位置是否居中</span>
                      <span className={`text-sm font-medium ${result.face_detection.centered ? 'text-green-600' : 'text-red-600'}`}>
                        {result.face_detection.centered ? '是' : '否'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">人脸旋转角度</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {result.face_detection.rotation}°
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">眼睛是否睁开</span>
                      <span className={`text-sm font-medium ${result.face_detection.eyesOpen ? 'text-green-600' : 'text-red-600'}`}>
                        {result.face_detection.eyesOpen ? '是' : '否'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
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
              
              <div className="grid gap-4 text-sm bg-gradient-to-b from-white to-[#f5f5f7] rounded-lg p-4 border border-[#e5e5ea] dark:bg-black/15">
                {result.checks && result.checks.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[#1c1c1e] font-medium dark:text-white">检查结果</span>
                    <ul className="space-y-1">
                      {result.checks.map((c, i) => (
                        <li key={i} className="text-[#3a3a3c] dark:text-gray-300">{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex flex-col md:flex-row md:items-center gap-2">
                  <div className="flex items-center gap-2 min-w-32">
                    <ImageIcon className="h-5 w-5 text-[#1c1c1e] dark:text-white" />
                    <span className="text-[#1c1c1e] font-medium dark:text-white">提示信息</span>
                  </div>
                  <span className="text-[#3a3a3c] ml-7 md:ml-0 dark:text-gray-300">{result.message}</span>
                </div>
                
                {result.dimensions && (
                  <div className="flex flex-col md:flex-row md:items-center gap-2">
                    <div className="flex items-center gap-2 min-w-32">
                      <Ruler className="h-5 w-5 text-[#1c1c1e] dark:text-white" />
                      <span className="text-[#1c1c1e] font-medium dark:text-white">照片尺寸</span>
                    </div>
                    <span className="text-[#3a3a3c] ml-7 md:ml-0 dark:text-gray-300">{result.dimensions.width} x {result.dimensions.height} 像素</span>
                  </div>
                )}
                
                {result.file_size !== undefined && (
                  <div className="flex flex-col md:flex-row md:items-center gap-2">
                    <div className="flex items-center gap-2 min-w-32">
                      <FileText className="h-5 w-5 text-[#1c1c1e] dark:text-white" />
                      <span className="text-[#1c1c1e] font-medium dark:text-white">文件大小</span>
                    </div>
                    <span className="text-[#3a3a3c] ml-7 md:ml-0 dark:text-gray-300">{result.file_size.toFixed(2)} KB</span>
                  </div>
                )}
              </div>
              
              {result.suggestion && (
                <div className="flex flex-col gap-3 bg-gradient-to-b from-[#f5f5f7] to-white p-4 rounded-lg border border-[#e5e5ea] shadow-sm dark:from-gray-800 dark:to-black dark:border-white/10">
                  <span className="text-[#1c1c1e] font-medium text-base dark:text-white">建议</span>
                  <p className="text-[#3a3a3c] leading-relaxed text-sm dark:text-gray-300 whitespace-pre-wrap">{result.suggestion}</p>
                </div>
              )}
              {result.processed_photo_download_url && (
                <div className="pt-4 border-t border-gray-200 dark:border-white/10">
                  <a
                    href={result.processed_photo_download_url}
                    download
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <FileText className="h-5 w-5" />
                    下载处理后的照片
                  </a>
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
