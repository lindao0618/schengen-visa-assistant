import Link from "next/link"

const feedbackActions = [
  {
    href: "/material-review",
    eyebrow: "材料审核",
    title: "上传材料并立即检查",
    description: "进入现有材料审核工具，适合专员快速核对客户文件是否齐全、是否需要补件。",
    action: "打开材料审核",
  },
  {
    href: "/docs/common-issues",
    eyebrow: "常见问题",
    title: "先查看已整理的问题",
    description: "把高频问题和处理方式集中在文档里，减少重复沟通和内部查找时间。",
    action: "查看问题文档",
  },
  {
    href: "/ai-assistant",
    eyebrow: "功能建议",
    title: "用 AI 助手整理建议",
    description: "先把你想优化的流程、页面或自动化任务描述清楚，再交给团队评估开发优先级。",
    action: "打开 AI 助手",
  },
]

export default function FeedbackPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_30rem),linear-gradient(180deg,_#f8fafc,_#ffffff)] px-4 py-12">
      <section className="mx-auto max-w-5xl">
        <div className="mb-8 rounded-[2rem] border border-blue-100 bg-white/90 p-8 shadow-xl shadow-blue-100/60">
          <div className="mb-4 inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            反馈与材料入口
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            选择你现在要处理的事情
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            这个页面用于承接首页和下载完成页的反馈入口，避免用户进入 404。当前先使用已有工具分流，不新增未验证的表单数据流。
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {feedbackActions.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-100/60"
            >
              <div className="mb-4 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {item.eyebrow}
              </div>
              <h2 className="text-lg font-semibold text-slate-950">{item.title}</h2>
              <p className="mt-2 min-h-[4.5rem] text-sm leading-6 text-slate-600">{item.description}</p>
              <span className="mt-5 inline-flex text-sm font-semibold text-blue-700 group-hover:text-blue-800">
                {item.action} →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
