"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useActiveApplicantProfile } from "@/hooks/use-active-applicant-profile"
import { Upload, RefreshCw } from "lucide-react"
import { toast } from "sonner"

const MATERIAL_REVIEW_TASK_IDS_KEY = "material-review-task-ids"

const MaterialTaskList = dynamic(
  () => import("@/components/MaterialTaskList").then((mod) => mod.MaterialTaskList),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white/70 p-4 text-sm text-gray-500">
        正在加载任务列表...
      </div>
    ),
  },
)

function loadStoredTaskIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const s = localStorage.getItem(MATERIAL_REVIEW_TASK_IDS_KEY)
    if (!s) return []
    const arr = JSON.parse(s) as string[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function storeTaskIds(ids: string[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(MATERIAL_REVIEW_TASK_IDS_KEY, JSON.stringify(ids.slice(-50)))
  } catch {
    /* ignore */
  }
}

export default function MaterialReviewClientPage() {
  const activeApplicant = useActiveApplicantProfile()
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState("itinerary")
  const [visaType, setVisaType] = useState("schengen")
  const [taskIds, setTaskIds] = useState<string[]>(() => [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [bookingVerify, setBookingVerify] = useState(false)

  // 机票/车票、酒店预订、保险补充信息
  const [customerName, setCustomerName] = useState("")
  const [departureDate, setDepartureDate] = useState("")
  const [returnDate, setReturnDate] = useState("")

  useEffect(() => {
    setTaskIds(loadStoredTaskIds())
  }, [])

  useEffect(() => {
    storeTaskIds(taskIds)
  }, [taskIds])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategory(e.target.value);
  };

  const handleVisaTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setVisaType(e.target.value);
  };

  const handleReset = () => {
    setFile(null)
    setError("")
    setCustomerName("")
    setDepartureDate("")
    setReturnDate("")
    setBookingVerify(false)
  }

  const needsFlightHotelFields = category === "flight" || category === "hotel"
  const needsInsuranceFields = category === "insurance"

  const handleUpload = async () => {
    if (!file) {
      setError("请选择文件")
      return
    }
    if (category === "hotel") {
      if (!customerName?.trim()) {
        setError("酒店审核需填写客户姓名")
        return
      }
      if (!departureDate) {
        setError("酒店审核需填写入住日期")
        return
      }
      if (!returnDate) {
        setError("酒店审核需填写退房日期")
        return
      }
    }
    setLoading(true)
    setError("")
    toast.info("正在创建任务，请在下方的任务列表中查看进度...")

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("document_type", category)
      formData.append("visa_type", visaType)
      if (activeApplicant?.id) {
        formData.append("applicantProfileId", activeApplicant.id)
        if (activeApplicant.activeCaseId) {
          formData.append("caseId", activeApplicant.activeCaseId)
        }
      }
      if (needsFlightHotelFields || needsInsuranceFields) {
        if (customerName) formData.append("customer_name", customerName)
        if (departureDate) formData.append("departure_date", departureDate)
        if (needsFlightHotelFields && returnDate)
          formData.append("return_date", returnDate)
      }
      if (category === "hotel" && bookingVerify) {
        formData.append("booking_verify", "true")
      }

      const response = await fetch("/api/material-review/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: 上传失败`)
      }

      if (data.task_id) {
        setTaskIds((prev) => [...prev, data.task_id])
        toast.success("任务已创建，请在下方的任务列表中查看进度与结果。")
        handleReset()
      } else {
        throw new Error("API 响应异常")
      }
    } catch (err) {
      console.error("Upload error:", err)
      if (err instanceof Error) {
        setError(`上传失败: ${err.message}`)
        toast.error(err.message)
      } else {
        setError("上传失败，请重试")
        toast.error("上传失败，请重试")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white pt-20">
      <Card className="max-w-4xl mx-auto bg-white border-gray-200 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900">材料审核</CardTitle>
          <CardDescription className="text-gray-600">
            上传您的申根签证申请材料，我们将为您进行AI智能审核
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-700">签证类型</Label>
              <select
                value={visaType}
                onChange={handleVisaTypeChange}
                className="w-full p-2 rounded-lg bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="schengen">申根签证</option>
                <option value="usa">美国签证</option>
                <option value="uk">英国签证</option>
                <option value="japan">日本签证</option>
                <option value="australia">澳大利亚签证</option>
                <option value="canada">加拿大签证</option>
                <option value="newzealand">新西兰签证</option>
                <option value="singapore">新加坡签证</option>
                <option value="korea">韩国签证</option>
                <option value="other">其他签证</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-700">申请材料</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                {file ? (
                  <div className="flex items-center justify-between text-gray-900">
                    <span className="text-sm">{file.name}</span>
                    <button
                      onClick={() => setFile(null)}
                      className="text-red-500 hover:text-red-600"
                    >
                      删除
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-center mb-4">
                      <Upload className="h-12 w-12 text-gray-400" />
                    </div>
                    <p className="text-gray-600 mb-2">拖拽文件到这里，或者点击选择文件</p>
                    <p className="text-sm text-gray-500">支持 PDF、JPG、PNG 格式，最大文件大小 10MB</p>
                  </div>
                )}
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png,.txt"
                  className="hidden"
                  id="fileInput"
                />
                <label
                  htmlFor="fileInput"
                  className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
                >
                  选择文件
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-700">材料类型</Label>
              <select
                value={category}
                onChange={handleCategoryChange}
                className="w-full p-2 rounded-lg bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="itinerary">行程单</option>
                <option value="hotel">酒店预订</option>
                <option value="bank_statement">银行流水</option>
                <option value="flight">机票/车票</option>
                <option value="insurance">旅行保险</option>
                <option value="other">其他材料</option>
              </select>
            </div>

            {/* 机票/车票、酒店预订：补充信息 */}
            {needsFlightHotelFields && (
              <div className="space-y-4 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  请补充以下信息，便于AI更精准核对材料
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-700">客户姓名</Label>
                    <Input
                      placeholder="如：ZHANG San"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700">入住日期</Label>
                    <Input
                      type="date"
                      value={departureDate}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700">退房日期</Label>
                    <Input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                </div>
                {category === "hotel" && (
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
                      <input
                        type="checkbox"
                        checked={bookingVerify}
                        onChange={(e) => setBookingVerify(e.target.checked)}
                        className="h-4 w-4 rounded border-amber-300 text-blue-600 focus:ring-blue-500"
                      />
                      验证 Booking.com 订单（需CONFIRMATION NUMBER与PIN）
                    </label>
                    {bookingVerify && (
                      <div className="text-xs text-amber-700 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded p-2 bg-white/70 dark:bg-black/20">
                        将从OCR中提取确认号与PIN，并在 Booking.com 进行核验。
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 保险：补充信息 */}
            {needsInsuranceFields && (
              <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  请补充以下信息，便于AI更精准核对保险单
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-700">投保人姓名</Label>
                    <Input
                      placeholder="如：ZHANG San"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700">出发时间</Label>
                    <Input
                      type="date"
                      value={departureDate}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleUpload}
                disabled={loading || !file}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? "上传分析中..." : "上传并分析文件"}
              </Button>
              {file && (
                <Button onClick={handleReset} variant="outline" className="px-4">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            <div className="mt-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                提交后将在此显示进度与结果
              </p>
              <MaterialTaskList
                taskIds={taskIds}
                filterTaskTypes={["material-review"]}
                title="材料审核任务"
                pollInterval={2000}
                autoRefresh={true}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
