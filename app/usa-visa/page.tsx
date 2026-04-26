"use client"

import { useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Camera, FileSpreadsheet, FileCheck, UserPlus, FileText } from "lucide-react"
import { AuthPromptProvider } from "./contexts/AuthPromptContext"
import {
  ACTIVE_APPLICANT_CASE_KEY,
  ACTIVE_APPLICANT_PROFILE_KEY,
  ApplicantProfileSelector,
} from "@/components/applicant-profile-selector"
import { usePrefetchApplicantDetail } from "@/hooks/use-prefetch-applicant-detail"
import { PhotoChecker } from "./components/photo-checker"
import { DS160Form } from "./components/ds160-form"
import { SubmitDS160Form } from "./components/submit-ds160-form"
import { RegisterAISForm } from "./components/register-ais-form"
import { InterviewBriefForm } from "./components/interview-brief-form"
import { TaskList } from "./components/task-list"
import { UsVisaQuickStartCard } from "./components/us-visa-quick-start-card"

export default function USAVisaPage() {
  const searchParams = useSearchParams()

  const defaultTab = useMemo(() => {
    const requestedTab = searchParams.get("tab") || ""
    const allowedTabs = new Set(["photo", "ds160-fill", "ds160-submit", "ais-register", "interview-brief"])
    return allowedTabs.has(requestedTab) ? requestedTab : "photo"
  }, [searchParams])

  const applicantProfileId = searchParams.get("applicantProfileId")?.trim() || ""
  const caseId = searchParams.get("caseId")?.trim() || ""
  usePrefetchApplicantDetail(applicantProfileId, { view: "active" })

  useEffect(() => {
    if (typeof window === "undefined" || !applicantProfileId) return

    window.localStorage.setItem(ACTIVE_APPLICANT_PROFILE_KEY, applicantProfileId)
    window.dispatchEvent(
      new CustomEvent("active-applicant-profile-changed", {
        detail: { applicantProfileId },
      }),
    )

    if (!caseId) return

    window.localStorage.setItem(ACTIVE_APPLICANT_CASE_KEY, caseId)
    window.localStorage.setItem(`${ACTIVE_APPLICANT_CASE_KEY}:${applicantProfileId}`, caseId)
    window.dispatchEvent(
      new CustomEvent("active-applicant-case-changed", {
        detail: { applicantProfileId, caseId },
      }),
    )
  }, [applicantProfileId, caseId])

  return (
    <AuthPromptProvider>
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-b from-gray-900 to-gray-700 dark:from-white dark:to-gray-400">美国签证申请助手</h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg">一站式美国签证申请解决方案</p>
        </div>

        <div className="w-full mx-auto">
          <ApplicantProfileSelector scope="usa-visa" />
          <UsVisaQuickStartCard />
          <Tabs key={defaultTab} defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 h-12 mb-6 bg-gray-100/80 dark:bg-black/50 backdrop-blur-xl p-1 rounded-2xl border border-gray-200/50 dark:border-white/10 shadow-lg">
              <TabsTrigger value="photo" className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                照片检测
              </TabsTrigger>
              <TabsTrigger value="ds160-fill" className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                DS160 填表
              </TabsTrigger>
              <TabsTrigger value="ds160-submit" className="flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                提交 DS160
              </TabsTrigger>
              <TabsTrigger value="ais-register" className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                AIS 注册
              </TabsTrigger>
              <TabsTrigger value="interview-brief" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                面试必看
              </TabsTrigger>
            </TabsList>

            <TabsContent value="photo">
              <Card className="backdrop-blur-md bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-black border border-gray-200/50 dark:border-gray-800/50 shadow-2xl rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-gray-100 dark:border-gray-800/50">
                  <CardTitle className="text-2xl font-semibold flex items-center gap-2">
                    <Camera className="h-6 w-6" />
                    签证照片检测
                  </CardTitle>
                  <CardDescription>
                    处理照片 → 检查是否符合要求 → 提供下载
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <PhotoChecker />
                </CardContent>
              </Card>
              <div id="us-photo-tasks" className="mt-6">
                <TaskList filterTaskTypes={["check-photo"]} title="照片检测任务" pollInterval={2000} autoRefresh={true} />
              </div>
            </TabsContent>

            <TabsContent value="ds160-fill">
              <Card className="backdrop-blur-md bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-black border border-gray-200/50 dark:border-gray-800/50 shadow-2xl rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-gray-100 dark:border-gray-800/50">
                  <CardTitle className="text-2xl font-semibold flex items-center gap-2">
                    <FileSpreadsheet className="h-6 w-6" />
                    DS-160 批量填表
                  </CardTitle>
                  <CardDescription>
                    上传 Excel 和照片，自动填写 DS-160 表单
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <DS160Form />
                </CardContent>
              </Card>
              <div id="us-ds160-fill-tasks" className="mt-6">
                <TaskList filterTaskTypes={["fill-ds160"]} title="DS-160 填表任务" pollInterval={2000} autoRefresh={true} />
              </div>
            </TabsContent>

            <TabsContent value="ds160-submit">
              <Card className="backdrop-blur-md bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-black border border-gray-200/50 dark:border-gray-800/50 shadow-2xl rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-gray-100 dark:border-gray-800/50">
                  <CardTitle className="text-2xl font-semibold flex items-center gap-2">
                    <FileCheck className="h-6 w-6" />
                    提交 DS-160 申请表
                  </CardTitle>
                  <CardDescription>
                    使用 AA 码、姓、出生年、护照号提交并获取 PDF 确认页
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <SubmitDS160Form />
                </CardContent>
              </Card>
              <div id="us-ds160-submit-tasks" className="mt-6">
                <TaskList filterTaskTypes={["submit-ds160"]} title="提交 DS160 任务" pollInterval={2000} autoRefresh={true} />
              </div>
            </TabsContent>

            <TabsContent value="ais-register">
              <Card className="backdrop-blur-md bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-black border border-gray-200/50 dark:border-gray-800/50 shadow-2xl rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-gray-100 dark:border-gray-800/50">
                  <CardTitle className="text-2xl font-semibold flex items-center gap-2">
                    <UserPlus className="h-6 w-6" />
                    AIS 账号注册
                  </CardTitle>
                  <CardDescription>
                    上传 Excel，在 ais.usvisa-info.com 上自动注册签证预约账号
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <RegisterAISForm />
                </CardContent>
              </Card>
              <div id="us-ais-register-tasks" className="mt-6">
                <TaskList filterTaskTypes={["register-ais"]} title="AIS 注册任务" pollInterval={2000} autoRefresh={true} />
              </div>
            </TabsContent>

            <TabsContent value="interview-brief">
              <Card className="backdrop-blur-md bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-black border border-gray-200/50 dark:border-gray-800/50 shadow-2xl rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-gray-100 dark:border-gray-800/50">
                  <CardTitle className="text-2xl font-semibold flex items-center gap-2">
                    <FileText className="h-6 w-6" />
                    面试必看与 PDF
                  </CardTitle>
                  <CardDescription>
                    上传递签之前必看 Word 模板，自动替换中间问答区并导出新的 Word / PDF。
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <InterviewBriefForm />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
    </AuthPromptProvider>
  )
}
