"use client"

import Link from "next/link"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, ChevronRight } from "lucide-react"

const AUTOMATION_TYPES = [
  {
    id: "france",
    label: "法签（法国）",
    description: "France-visas 注册信息提取、账号注册、生成申请、填回执、提交最终表",
    flag: "https://flagcdn.com/w80/fr.png",
    link: "/schengen-visa/france/automation",
  },
]

export default function AutomationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-b from-gray-900 to-gray-700 dark:from-white dark:to-gray-400">
            自动化填表
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            按签证类型选择，自动填写对应官网表格
          </p>
        </div>

        <Card className="backdrop-blur-md bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-black border border-gray-200/50 dark:border-gray-800/50 shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-gray-100 dark:border-gray-800/50">
            <CardTitle className="text-2xl font-semibold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              选择签证类型
            </CardTitle>
            <CardDescription>
              不同国家/类型对应不同的填表流程，请选择您要办理的签证
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {AUTOMATION_TYPES.map((item) => (
                <Link
                  key={item.id}
                  href={item.link}
                  className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-gray-200/50 dark:border-gray-800/50 bg-white/80 dark:bg-gray-900/50 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg transition-all duration-200 group"
                >
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 shadow-sm">
                    <Image
                      src={item.flag}
                      alt={item.label}
                      width={48}
                      height={48}
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-900 dark:text-gray-100 block">
                      {item.label}
                    </span>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {item.description}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 shrink-0 self-center sm:self-auto" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
