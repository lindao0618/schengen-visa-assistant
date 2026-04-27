"use client"

import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Book, Users, Hammer, ArrowRight, MessageSquare } from "lucide-react"

export default function HomeClientPage() {
  const router = useRouter()
  const { status } = useSession()

  const handleStartApplication = () => {
    if (status === "loading") return
    router.push(status === "authenticated" ? "/dashboard" : "/login")
  }

  return (
    <div className="flex flex-col min-h-screen w-full bg-white dark:bg-black overflow-x-hidden">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-20 bg-gradient-to-b from-white via-white to-gray-100 dark:bg-gradient-to-b dark:from-gray-900 dark:to-gray-950">
        <div className="w-16 h-16 bg-gradient-to-b from-white to-gray-200 dark:from-gray-800 dark:to-black rounded-2xl flex items-center justify-center mb-8 shadow-lg border border-gray-200/50 dark:border-white/10">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-8 h-8 text-gray-800 dark:text-white"
          >
            <path d="M20 12H4" />
            <path d="M4 12l6-6" />
            <path d="M4 12l6 6" />
          </svg>
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold bg-clip-text text-transparent bg-gradient-to-b from-gray-900 to-gray-700 dark:from-white dark:to-gray-400 text-center mb-4 animate-fade-in">
          欢迎使用 Vistoria
        </h1>
        <div className="relative mb-8">
          <p className="text-gray-600 dark:text-gray-300 text-center text-lg max-w-3xl mb-2 animate-fade-in delay-100">
            专为在英留学生设计的智能签证申请助手，提供申根签证、美国签证等多国签证申请指导和支持。
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4 max-w-2xl mx-auto">
            <p className="text-blue-700 dark:text-blue-300 text-sm font-medium text-center">
              🎓 特别服务：英国留学生圣诞节、复活节假期申根签证快速办理
            </p>
          </div>
          <div className="absolute -inset-6 -z-10 blur-xl bg-gradient-to-r from-gray-200 via-transparent to-gray-200 dark:from-gray-800 dark:via-transparent dark:to-gray-800 opacity-30 rounded-3xl"></div>
        </div>
        <div className="flex flex-col items-center gap-2 animate-fade-in delay-200">
          <div className="flex gap-4">
            <Button size="lg" onClick={handleStartApplication} disabled={status === "loading"} className="bg-gray-900 hover:bg-black text-white shadow-lg shadow-gray-300/30 dark:shadow-black/30 border border-gray-800">
              开始申请
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => router.push("/guest")}
              className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              游客模式
            </Button>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-4 font-medium flex items-center">
            <span className="inline-flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 h-5 w-5 text-xs mr-2">3</span>
            步完成签证申请，平均仅需 5 分钟
          </p>
        </div>
      </div>

      {/* UK Students Special Section */}
      <div className="container mx-auto px-4 py-16 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-800 dark:to-purple-800">
        <div className="text-center text-white mb-12">
          <h2 className="text-3xl font-bold mb-4">🇬🇧 英国留学生专属服务</h2>
          <p className="text-blue-100 text-lg max-w-3xl mx-auto">
            针对15万+在英中国留学生的申根签证需求，我们提供季节性高峰期的专业申请服务
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="text-4xl mb-4">🎄</div>
            <h3 className="text-xl font-bold text-white mb-2">圣诞假期专线</h3>
            <p className="text-blue-100 text-sm">12月-1月申根签证快速办理，避开高峰期预约难题</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="text-4xl mb-4">🐰</div>
            <h3 className="text-xl font-bold text-white mb-2">复活节特快</h3>
            <p className="text-blue-100 text-sm">3月-4月春季旅游签证优先处理，成功率95%+</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="text-4xl mb-4">📚</div>
            <h3 className="text-xl font-bold text-white mb-2">学生身份优化</h3>
            <p className="text-blue-100 text-sm">专门针对英国留学生身份的材料清单和申请策略</p>
          </div>
        </div>
        
        <div className="text-center mt-8">
          <Button 
            size="lg" 
            className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-8 py-3"
            onClick={() => router.push("/schengen-visa")}
          >
            立即申请申根签证 →
          </Button>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="container mx-auto px-4 py-20 bg-gradient-to-b from-gray-100 to-gray-200 dark:bg-gradient-to-b dark:from-gray-950 dark:to-black rounded-b-3xl">
        <h2 className="text-3xl font-bold text-center mb-12 bg-clip-text text-transparent bg-gradient-to-b from-gray-900 to-gray-700 dark:from-white dark:to-gray-400">我们能为您提供的服务</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Link href="/visa-info" className="block group">
            <Card className="backdrop-blur-md bg-white dark:bg-gray-800 border-2 border-l-4 border-gray-300 dark:border-gray-700 border-l-blue-500 dark:border-l-blue-600 hover:border-gray-300 dark:hover:border-gray-500 hover:border-l-blue-500 dark:hover:border-l-blue-400 transition-all duration-300 rounded-2xl overflow-hidden h-full transform hover:scale-[1.02] shadow-lg hover:shadow-2xl"
            >
              <CardHeader className="border-b border-gray-100 dark:border-gray-800/50">
                <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-gray-700 flex items-center justify-center mb-4">
                  <Book className="w-6 h-6 text-gray-900 dark:text-white" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">签证指南</CardTitle>
              </CardHeader>
              <CardContent className="text-gray-600 dark:text-gray-200 pt-4 text-sm">
                获取最新的各国签证申请要求和流程信息，包括申根、美国、日本等。
              </CardContent>
            </Card>
          </Link>



          <Link href="/feedback" className="block group">
            <Card className="backdrop-blur-md bg-white dark:bg-gray-800 border-2 border-l-4 border-gray-300 dark:border-gray-700 border-l-blue-500 dark:border-l-blue-600 hover:border-gray-300 dark:hover:border-gray-500 hover:border-l-blue-500 dark:hover:border-l-blue-400 transition-all duration-300 rounded-2xl overflow-hidden h-full transform hover:scale-[1.02] shadow-lg hover:shadow-2xl">
              <CardHeader className="border-b border-gray-100 dark:border-gray-700">
                <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-gray-700 flex items-center justify-center mb-4">
                  <Hammer className="w-6 h-6 text-gray-900 dark:text-white" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">材料审核</CardTitle>
              </CardHeader>
              <CardContent className="text-gray-600 dark:text-gray-200 pt-4 text-sm">专业审核您的申请材料，提高签证申请成功率。</CardContent>
            </Card>
          </Link>

          <Link href="/ai-assistant" className="block group">
            <Card className="backdrop-blur-md bg-white dark:bg-gray-800 border-2 border-l-4 border-gray-300 dark:border-gray-700 border-l-blue-500 dark:border-l-blue-600 hover:border-gray-300 dark:hover:border-gray-500 hover:border-l-blue-500 dark:hover:border-l-blue-400 transition-all duration-300 rounded-2xl overflow-hidden h-full transform hover:scale-[1.02] shadow-lg hover:shadow-2xl">
              <CardHeader className="border-b border-gray-100 dark:border-gray-700">
                <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-gray-700 flex items-center justify-center mb-4">
                  <MessageSquare className="w-6 h-6 text-gray-900 dark:text-white" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">AI答疑</CardTitle>
              </CardHeader>
              <CardContent className="text-gray-600 dark:text-gray-200 pt-4 text-sm">实时解答您关于签证申请的各类问题，智能助手随时为您服务。</CardContent>
            </Card>
          </Link>
        </div>
        
        {/* Statistics Section */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 mt-12 border border-gray-200 dark:border-gray-800">
          <h3 className="text-2xl font-bold text-center mb-8 text-gray-900 dark:text-white">📊 英国留学生申根签证需求数据</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">15.1万+</div>
              <div className="text-gray-600 dark:text-gray-400 text-sm">在英中国留学生总数</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">85%</div>
              <div className="text-gray-600 dark:text-gray-400 text-sm">计划申请申根签证比例</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">1.8次</div>
              <div className="text-gray-600 dark:text-gray-400 text-sm">年均申请次数</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">95%+</div>
              <div className="text-gray-600 dark:text-gray-400 text-sm">我们的申请成功率</div>
            </div>
          </div>
        </div>
        
        <div className="h-6"></div>
      </div>

      {/* Footer Section */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-12 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black shadow-md mt-4">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {/* Company Info */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Vistoria</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">您的专业签证申请助手，提供高效、可靠的签证申请服务。</p>
              <div className="flex space-x-4">
                <Link href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"></path></svg>
                </Link>
                <Link href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"></path></svg>
                </Link>
                <Link href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm0 22c-5.514 0-10-4.486-10-10s4.486-10 10-10 10 4.486 10 10-4.486 10-10 10zm-2.426-7.366l-1.484-1.484 1.484-1.484-1.484-1.484 1.484-1.484 2.97 2.968-2.97 2.968zm6.281-2.968l-2.97 2.968-1.484-1.484 1.484-1.484-1.484-1.484 1.484-1.484 2.97 2.968z"></path></svg>
                </Link>
              </div>
            </div>
            
            {/* Quick Links */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">快速链接</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/dashboard" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">个人中心</Link>
                </li>
                <li>
                  <Link href="/visa-info" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">签证指南</Link>
                </li>
                <li>
                  <Link href="/community" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">社区交流</Link>
                </li>
                <li>
                  <Link href="/feedback" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">材料审核</Link>
                </li>
              </ul>
            </div>
            
            {/* FAQ */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">常见问题</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/faq" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">签证申请流程</Link>
                </li>
                <li>
                  <Link href="/faq/docs" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">所需材料清单</Link>
                </li>
                <li>
                  <Link href="/faq/appointment" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">预约指南</Link>
                </li>
                <li>
                  <Link href="/docs/common-issues" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">常见问题与解决方案</Link>
                </li>
              </ul>
            </div>
            
            {/* Contact */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">联系我们</h3>
              <div className="space-y-2">
                <p className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  support@vistoria.com
                </p>
                <p className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  +86 123 4567 8910
                </p>
                <div className="flex items-center mt-4">
                  <Button variant="outline" size="sm" className="mr-2 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    在线客服
                  </Button>
                  <Button variant="outline" size="sm" className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                    </svg>
                    微信咨询
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-200 dark:border-gray-800 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              &copy; {new Date().getFullYear()} Vistoria. 所有权利均已保留。
            </p>
            <div className="flex space-x-4 mt-4 md:mt-0">
              <Link href="/privacy" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                隐私政策
              </Link>
              <Link href="/terms" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                用户协议
              </Link>
              <Link href="/about" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                关于我们
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
