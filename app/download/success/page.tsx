import Link from "next/link"
import { Book, Hammer, MessageSquare } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function DownloadSuccessPage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      {/* Logo Section */}
      <div className="mb-12 animate-fade-in">
        <div className="w-16 h-16 bg-emerald-500 rounded-lg flex items-center justify-center mb-6 mx-auto">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-8 h-8 text-white"
          >
            <path d="M5 12h14" />
            <path d="M12 5l7 7-7 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-center mb-2">感谢下载签证助手！</h1>
        <p className="text-gray-400 text-center">
          如果下载没有自动开始，请
          <Link href="#download" className="text-emerald-500 hover:text-emerald-400 ml-1">
            点击这里
          </Link>
        </p>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full">
        <Link href="/docs" className="block">
          <Card className="bg-zinc-900 border-zinc-800 hover:border-emerald-500/50 transition-all duration-300">
            <CardHeader>
              <Book className="w-10 h-10 text-emerald-500 mb-4" />
              <CardTitle className="text-white">使用文档</CardTitle>
              <CardDescription className="text-gray-400">了解签证助手的主要功能和使用方法</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" className="text-emerald-500 hover:text-emerald-400 p-0">
                查看文档 →
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/community" className="block">
          <Card className="bg-zinc-900 border-zinc-800 hover:border-emerald-500/50 transition-all duration-300">
            <CardHeader>
              <MessageSquare className="w-10 h-10 text-emerald-500 mb-4" />
              <CardTitle className="text-white">社区交流</CardTitle>
              <CardDescription className="text-gray-400">加入我们的社区，分享经验和获取帮助</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" className="text-emerald-500 hover:text-emerald-400 p-0">
                加入社区 →
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/feedback" className="block">
          <Card className="bg-zinc-900 border-zinc-800 hover:border-emerald-500/50 transition-all duration-300">
            <CardHeader>
              <Hammer className="w-10 h-10 text-emerald-500 mb-4" />
              <CardTitle className="text-white">功能建议</CardTitle>
              <CardDescription className="text-gray-400">想要新功能？告诉我们您的想法！</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" className="text-emerald-500 hover:text-emerald-400 p-0">
                提交建议 →
              </Button>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Common Issues Section */}
      <div className="mt-16 text-center">
        <h2 className="text-xl font-semibold mb-4">常见安装问题与解决方案</h2>
        <Link href="/docs/troubleshooting">
          <Button variant="outline" className="border-zinc-800 text-emerald-500 hover:text-emerald-400">
            查看安装指南
          </Button>
        </Link>
      </div>
    </div>
  )
}

