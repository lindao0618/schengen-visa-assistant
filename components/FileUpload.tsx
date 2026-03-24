"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, Upload } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type FileCategory = "itinerary" | "hotel" | "medical" | "transportation"

interface UploadedFile {
  file: File
  category: FileCategory
  aiResponse?: string
}

const categoryOptions: { value: FileCategory; label: string }[] = [
  { value: "itinerary", label: "行程单" },
  { value: "hotel", label: "酒店" },
  { value: "medical", label: "医疗证明" },
  { value: "transportation", label: "机票/欧洲之星火车" },
]

export function FileUpload() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({ file, category: "itinerary" as FileCategory }))
    setFiles((prev) => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  const handleCategoryChange = (fileIndex: number, category: FileCategory) => {
    setFiles((prev) => prev.map((file, index) => (index === fileIndex ? { ...file, category } : file)))
  }

  const uploadFiles = async () => {
    setUploading(true)
    setUploadProgress(0)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // 模拟上传过程
      for (let j = 0; j <= 100; j += 10) {
        setUploadProgress(j)
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      // 模拟AI分析过程
      await new Promise((resolve) => setTimeout(resolve, 500))

      // 模拟AI响应
      const aiResponse = `根据AI分析，您上传的${categoryOptions.find((c) => c.value === file.category)?.label}文件符合申根签证的要求。请确保所有信息准确无误。`

      setFiles((prev) => prev.map((f, index) => (index === i ? { ...f, aiResponse } : f)))
    }

    setUploading(false)
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer ${
          isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">拖拽文件到这里，或者点击选择文件</p>
        <p className="mt-1 text-xs text-gray-500">支持 PDF、JPG、PNG 格式，最大文件大小 10MB</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-4">
          {files.map((file, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle>{file.file.name}</CardTitle>
                <CardDescription>{(file.file.size / 1024 / 1024).toFixed(2)} MB</CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={file.category}
                  onValueChange={(value: FileCategory) => handleCategoryChange(index, value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择文件类别" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {file.aiResponse && (
                  <div className="mt-2 p-2 bg-green-100 rounded-md">
                    <div className="flex items-start">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                      <p className="text-sm">{file.aiResponse}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {files.length > 0 && !uploading && (
        <Button onClick={uploadFiles} className="w-full">
          上传并分析文件
        </Button>
      )}

      {uploading && (
        <div className="space-y-2">
          <Progress value={uploadProgress} className="w-full" />
          <p className="text-sm text-gray-600">上传中...{uploadProgress}%</p>
        </div>
      )}
    </div>
  )
}

