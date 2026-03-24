import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowRight, FileText, Calendar, StampIcon as Passport } from "lucide-react"

export default function GuestPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">签证信息（游客模式）</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">浏览各国签证申请要求和流程信息，注册账户可获取更多功能</p>
        </div>

        <Tabs defaultValue="schengen" className="space-y-8">
          <TabsList className="bg-zinc-900 border-zinc-800 w-full justify-center">
            <TabsTrigger value="schengen" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
              申根签证
            </TabsTrigger>
            <TabsTrigger value="usa" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
              美国签证
            </TabsTrigger>
            <TabsTrigger value="japan" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
              日本签证
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schengen">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-zinc-900 border-zinc-800 hover:border-emerald-500/50 transition-all duration-300">
                <CardHeader>
                  <FileText className="w-10 h-10 text-emerald-500 mb-4" />
                  <CardTitle className="text-white">申根签证概览</CardTitle>
                  <CardDescription className="text-gray-400">了解申根签证的基本信息</CardDescription>
                </CardHeader>
                <CardContent className="text-gray-300">
                  <ul className="space-y-2">
                    <li>• 申根签证允许持有人在申根区自由旅行</li>
                    <li>• 申根区包括26个欧洲国家</li>
                    <li>• 签证有效期通常为90天</li>
                    <li>• 可以用于旅游、商务或短期学习</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800 hover:border-emerald-500/50 transition-all duration-300">
                <CardHeader>
                  <Calendar className="w-10 h-10 text-emerald-500 mb-4" />
                  <CardTitle className="text-white">申请流程</CardTitle>
                  <CardDescription className="text-gray-400">申请申根签证的基本步骤</CardDescription>
                </CardHeader>
                <CardContent className="text-gray-300">
                  <ol className="space-y-2 list-decimal list-inside">
                    <li>确定目的地国家和签证类型</li>
                    <li>收集所需文件</li>
                    <li>预约面试</li>
                    <li>提交申请和支付费用</li>
                    <li>等待处理结果</li>
                  </ol>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800 hover:border-emerald-500/50 transition-all duration-300">
                <CardHeader>
                  <Passport className="w-10 h-10 text-emerald-500 mb-4" />
                  <CardTitle className="text-white">所需文件</CardTitle>
                  <CardDescription className="text-gray-400">申请申根签证通常需要的文件</CardDescription>
                </CardHeader>
                <CardContent className="text-gray-300">
                  <ul className="space-y-2">
                    <li>• 有效护照</li>
                    <li>• 签证照片</li>
                    <li>• 往返机票预订</li>
                    <li>• 住宿证明</li>
                    <li>• 旅行保险</li>
                    <li>• 财务证明</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Similar structure for USA and Japan tabs... */}
        </Tabs>

        <div className="mt-12">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="text-center">
              <CardTitle className="text-white text-2xl">注册账户的好处</CardTitle>
              <CardDescription className="text-gray-400">创建账户以获得更多功能</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-center">
                    <ArrowRight className="w-4 h-4 text-emerald-500 mr-2" />
                    个性化的申请指导
                  </li>
                  <li className="flex items-center">
                    <ArrowRight className="w-4 h-4 text-emerald-500 mr-2" />
                    进度跟踪
                  </li>
                  <li className="flex items-center">
                    <ArrowRight className="w-4 h-4 text-emerald-500 mr-2" />
                    文件清单和提醒
                  </li>
                  <li className="flex items-center">
                    <ArrowRight className="w-4 h-4 text-emerald-500 mr-2" />
                    与AI助手交互，获得即时帮助
                  </li>
                </ul>
                <div className="flex items-center justify-center">
                  <Link href="/register">
                    <Button className="bg-emerald-500 hover:bg-emerald-600 text-white">
                      立即注册
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

