"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Upload, FileCheck, Loader2, CheckCircle2, Mail, Camera, Download, Info, ExternalLink } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function DS160FormFixed() {
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [showTemplateInfo, setShowTemplateInfo] = useState(false)
  const [result, setResult] = useState<{
    status: string
    message: string
    downloadUrl?: string
    files?: Array<{
      filename: string;
      size: number;
      downloadUrl: string;
      type?: string;
    }>;
    aaCode?: string;
  } | null>(null)

  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setExcelFile(file)
      setResult(null)
    }
  }
  
  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      setResult(null)
    }
  }

  const processDS160 = async () => {
    if (!excelFile || !photoFile || !email) return
    
    // 简单验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setResult({
        status: 'error',
        message: '请输入有效的邮箱地址'
      });
      return;
    }
    
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("excel", excelFile)
      formData.append("photo", photoFile)
      formData.append("email", email)
      
      // 连接到本地DS160自动填写API
      console.log('🚀 开始DS160自动填表...');
      console.log('📄 Excel文件:', excelFile?.name);
      console.log('📷 照片文件:', photoFile?.name);
      console.log('📧 邮箱地址:', email);

      const response = await fetch("/api/usa-visa/ds160/auto-fill", {
        method: "POST",
        body: formData,
      });
        
      console.log('📡 API响应状态:', response.status);
        
      if (response.ok) {
        const data = await response.json();
        console.log('✅ DS160处理成功:', data);
          
        if (data.success) {
          setResult({
            status: 'success',
            message: `🎉 DS160表单生成成功！已生成 ${data.files?.length || 0} 个文件。${data.summary?.aaCode ? ` AA确认码: ${data.summary.aaCode}` : ''} 详细结果已发送至您的邮箱。`,
            files: data.files || [],
            aaCode: data.summary?.aaCode || ''
          });
        } else {
          setResult({
            status: 'error',
            message: data.message || 'DS160表单生成失败'
          });
        }
      } else {
        const errorData = await response.json().catch(() => ({ message: '服务器错误' }));
        setResult({
          status: 'error',
          message: errorData.message || `服务器错误 (${response.status})`
        });
      }
    } catch (error) {
      console.error("❌ 处理DS-160错误:", error);
      setResult({
        status: 'error',
        message: "网络连接错误，请检查网络后重试"
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 w-full mx-auto">
      <Card className="border-[#e5e5ea] shadow-sm overflow-hidden bg-white">
        <CardHeader className="bg-white border-b border-[#e5e5ea] pb-8">
          <CardTitle className="text-3xl font-bold flex items-center gap-3 text-[#1c1c1e]">
            <FileCheck className="h-7 w-7 text-[#1c1c1e]" />
            DS-160自动填表系统
          </CardTitle>
          <CardDescription className="text-base mt-3 text-[#8e8e93]">
            上传Excel表格和照片，我们将自动填写完整的DS-160表格并生成确认页面
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-6 space-y-8">
          <Card className="border-[#e5e5ea] shadow-sm bg-white mb-6">
            <CardContent className="pt-8 pb-8">
              <div className="flex flex-col md:flex-row md:items-start gap-8">
                <div className="flex-shrink-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-[#f5f5f7] shadow-sm flex items-center justify-center">
                    <ExternalLink className="h-10 w-10 text-[#1c1c1e]" />
                  </div>
                </div>
                
                <div className="flex-grow space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-[#1c1c1e] block mb-2">直接前往官方DS-160填表网站</h3>
                    <p className="text-sm text-[#8e8e93] mb-4">
                      如果您想手动填写DS-160表格，可以直接访问美国政府官方填表网站
                    </p>
                  </div>
                  <div>
                    <a 
                      href="https://ceac.state.gov/genniv/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-5 py-4 rounded-xl border-2 shadow-md transition-all duration-300 bg-gradient-to-b from-white to-gray-200 border-black hover:shadow-lg hover:border-black text-sm font-medium text-black"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      前往官方DS-160填表网站
                    </a>
                    <p className="mt-3 text-xs text-gray-500">
                      注意：官方网站填表较为复杂，需要准备大量材料并手动填写每一项内容
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-[#e5e5ea] shadow-sm bg-white">
              <CardContent className="pt-8 pb-8">
                <div className="flex flex-col md:flex-row md:items-start gap-8">
                  <div className="flex-shrink-0 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-[#f5f5f7] shadow-sm flex items-center justify-center">
                      <Upload className="h-10 w-10 text-[#1c1c1e]" />
                    </div>
                  </div>
                  
                  <div className="flex-grow space-y-4">
                    <div>
                      <Label htmlFor="ds160-excel" className="text-xl font-semibold text-[#1c1c1e] block mb-2">Excel表格上传</Label>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-[#8e8e93] mb-4">
                          上传填写好的DS-160 Excel模板文件
                        </p>
                        <Button 
                          variant="link" 
                          className="text-blue-600 p-0 h-auto text-sm mb-4"
                          onClick={() => setShowTemplateInfo(!showTemplateInfo)}
                        >
                          {showTemplateInfo ? "隐藏模板信息" : "查看模板信息"}
                        </Button>
                      </div>
                      {showTemplateInfo && (
                        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                          <h4 className="font-medium text-blue-800 mb-2">DS-160表格模板说明</h4>
                          <p className="text-sm text-blue-700 mb-2">使用我们提供的Excel模板，按照要求填写个人信息。</p>
                          <p className="text-sm text-blue-700 mb-2">确保所有必填字段都已完整填写，特别是个人信息、旅行计划和工作信息等部分。</p>
                          <a 
                            href="/ds160_data模板.xlsx" 
                            download
                            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
                          >
                            <FileCheck className="mr-1 h-4 w-4" />
                            下载Excel模板
                          </a>
                        </div>
                      )}
                    </div>
                    <div>
                      <Input
                        id="ds160-excel"
                        type="file"
                        accept=".xlsx"
                        onChange={handleExcelFileChange}
                        className="hidden"
                      />
                      <Label
                        htmlFor="ds160-excel"
                        className="cursor-pointer w-full"
                      >
                        <div className="flex items-center justify-center gap-2 px-5 py-4 rounded-xl border-2 shadow-md transition-all duration-300 bg-gradient-to-b from-white to-gray-200 border-black hover:shadow-lg hover:border-black">
                          <span className="text-sm font-medium text-black flex items-center gap-2">
                            <Upload className="h-4 w-4" />
                            {excelFile ? excelFile.name : "点击上传Excel模板"}
                          </span>
                        </div>
                      </Label>
                      {excelFile && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          文件已选择
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-[#e5e5ea] shadow-sm bg-white">
              <CardContent className="pt-8 pb-8">
                <div className="flex flex-col md:flex-row md:items-start gap-6">
                  <div className="flex-shrink-0 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-[#f5f5f7] shadow-sm flex items-center justify-center">
                      <Camera className="h-10 w-10 text-[#1c1c1e]" />
                    </div>
                  </div>
                  
                  <div className="flex-grow space-y-4">
                    <div>
                      <Label htmlFor="ds160-photo" className="text-xl font-semibold text-[#1c1c1e] block mb-2">证件照片上传</Label>
                      <p className="text-sm text-[#8e8e93] mb-4">
                        上传白底证件照片，JPG或PNG格式，尺寸不小于600x600像素
                      </p>
                    </div>
                    <div>
                      <Input
                        id="ds160-photo"
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={handlePhotoFileChange}
                        className="hidden"
                      />
                      <Label
                        htmlFor="ds160-photo"
                        className="cursor-pointer w-full"
                      >
                        <div className="flex items-center justify-center gap-2 px-5 py-4 rounded-xl border-2 shadow-md transition-all duration-300 bg-gradient-to-b from-white to-gray-200 border-black hover:shadow-lg hover:border-black">
                          <span className="text-sm font-medium text-black flex items-center gap-2">
                            <Upload className="h-4 w-4" />
                            {photoFile ? photoFile.name : "点击上传照片"}
                          </span>
                        </div>
                      </Label>
                      {photoFile && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          照片已选择
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card className="border-[#e5e5ea] shadow-sm bg-white">
            <CardContent className="pt-8 pb-8">
              <div className="flex flex-col md:flex-row md:items-start gap-8">
                <div className="flex-shrink-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-[#f5f5f7] shadow-sm flex items-center justify-center">
                    <Mail className="h-10 w-10 text-[#1c1c1e]" />
                  </div>
                </div>
                
                <div className="flex-grow space-y-4">
                  <div>
                    <Label htmlFor="ds160-email" className="text-xl font-semibold text-[#1c1c1e] block mb-2">您的邮箱地址</Label>
                    <p className="text-sm text-[#8e8e93] mb-4">
                      DS-160表格填写结果将发送至此邮箱
                    </p>
                  </div>
                  <div>
                    <Input
                      id="ds160-email"
                      type="email"
                      placeholder="请输入邮箱地址（如 example@email.com）"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white border-2 border-black py-7 px-5 text-base rounded-xl shadow-md hover:shadow-lg focus:border-black focus:shadow-lg focus:ring-0 transition-all"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
        
        <CardFooter className="flex flex-col items-center justify-center px-6 py-8 bg-white border-t border-[#e5e5ea] space-y-6">
          <Button
            onClick={processDS160}
            disabled={!excelFile || !photoFile || !email || loading}
            className="bg-gradient-to-b from-[#1c1c1e] to-black hover:from-black hover:to-[#3a3a3c] text-white shadow-lg px-10 py-7 w-full md:w-3/4 lg:w-1/2 border border-[#3a3a3c] text-lg font-semibold transition-all duration-300 rounded-xl"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                正在自动填写 DS-160 表格...
              </>
            ) : (
              '🚀 开始自动生成 DS-160 表格'
            )}
          </Button>
          
          <div className="flex flex-wrap justify-center gap-3">
            <Badge variant="outline" className="bg-white text-[#1c1c1e] border-[#d1d1d6] py-2 px-4 text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              真实自动填写
            </Badge>
            <Badge variant="outline" className="bg-white text-[#1c1c1e] border-[#d1d1d6] py-2 px-4 text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              生成确认页面
            </Badge>
            <Badge variant="outline" className="bg-white text-[#1c1c1e] border-[#d1d1d6] py-2 px-4 text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              安全可靠
            </Badge>
          </div>
        </CardFooter>
      </Card>
      
      {result && (
        <Card className="border-0 mt-6">
          <CardContent>
            <Alert variant={result.status === 'success' ? "default" : "destructive"} className="border-2">
              <AlertTitle className="text-lg font-medium">
                {result.status === 'success' ? "✅ 处理成功" : "❌ 处理失败"}
              </AlertTitle>
              <AlertDescription className="text-base">
                {result.message}
              </AlertDescription>
              {result.status === 'success' && (
                <div className="mt-4 space-y-4">
                  <p className="text-sm text-gray-600">
                    📧 详细结果已发送至您的邮箱: {email}
                  </p>
                  {result.aaCode && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm font-medium text-blue-800">
                        🔑 AA确认码: <span className="font-bold text-blue-900">{result.aaCode}</span>
                      </p>
                    </div>
                  )}
                  {result.files && result.files.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">📄 生成的文件:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {result.files.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {file.filename}
                              </p>
                              <p className="text-xs text-gray-500">
                                {(file.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(file.downloadUrl, '_blank')}
                              className="ml-2 flex-shrink-0"
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
