import Link from "next/link"

const nextSteps = [
  {
    href: "/docs",
    icon: "文",
    title: "使用文档",
    description: "了解签证助手的主要功能和使用方法",
    action: "查看文档",
  },
  {
    href: "/community",
    icon: "聊",
    title: "社区交流",
    description: "加入我们的社区，分享经验和获取帮助",
    action: "加入社区",
  },
  {
    href: "/feedback",
    icon: "建",
    title: "功能建议",
    description: "想要新功能？告诉我们您的想法！",
    action: "提交建议",
  },
]

export default function DownloadSuccessPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-16 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-6xl flex-col items-center justify-center">
        <div className="mb-12 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/25">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-white"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </div>
          <h1 className="mb-3 text-3xl font-bold md:text-4xl">感谢下载签证助手！</h1>
          <p className="text-gray-400">
            如果下载没有自动开始，请
            <Link href="#download" className="ml-1 text-emerald-400 hover:text-emerald-300">
              点击这里
            </Link>
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-3">
          {nextSteps.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition duration-300 hover:-translate-y-1 hover:border-emerald-500/60 hover:bg-zinc-900"
            >
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-lg font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
                {item.icon}
              </div>
              <h2 className="mb-2 text-xl font-semibold text-white">{item.title}</h2>
              <p className="mb-8 min-h-[3rem] text-sm leading-6 text-gray-400">{item.description}</p>
              <span className="text-sm font-medium text-emerald-400 group-hover:text-emerald-300">
                {item.action} →
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-16 text-center">
          <h2 className="mb-5 text-xl font-semibold">常见安装问题与解决方案</h2>
          <Link
            href="/docs/troubleshooting"
            className="inline-flex rounded-full border border-zinc-800 px-6 py-3 text-sm font-medium text-emerald-400 transition hover:border-emerald-500/60 hover:text-emerald-300"
          >
            查看安装指南
          </Link>
        </div>
      </section>
    </main>
  )
}
