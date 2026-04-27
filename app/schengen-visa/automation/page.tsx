import Link from "next/link"

const AUTOMATION_TYPES = [
  {
    id: "france",
    label: "法签（法国）",
    description: "覆盖 France-visas 注册信息提取、账号注册、生成申请、填回执、提交最终表。",
    href: "/schengen-visa/france/automation",
    status: "已接入",
    steps: ["注册信息", "申请表生成", "TLS 提交"],
  },
]

export default function AutomationPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_28rem),linear-gradient(180deg,_#f8fafc,_#eef2ff)] px-4 py-10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(30,64,175,0.26),_transparent_28rem),linear-gradient(180deg,_#020617,_#030712)]">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8 max-w-3xl">
          <p className="mb-3 inline-flex rounded-full border border-blue-200 bg-white/75 px-3 py-1 text-sm font-medium text-blue-700 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
            申根业务自动化
          </p>
          <h1 className="text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            自动化填表
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
            按签证类型进入对应流程，减少重复录入，让专员把时间放在材料判断和客户沟通上。
          </p>
        </div>

        <div className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-2xl shadow-blue-100/70 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70 dark:shadow-black/30 sm:p-7">
          <div className="mb-6 flex flex-col gap-2 border-b border-slate-200 pb-5 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-950 dark:text-white">选择签证类型</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                不同国家和类型对应不同官网流程，请选择要办理的自动化任务。
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              {AUTOMATION_TYPES.length} 个流程可用
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {AUTOMATION_TYPES.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="group flex min-h-48 flex-col justify-between rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-100 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950 dark:hover:border-blue-700 dark:hover:shadow-black/40"
              >
                <div>
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white shadow-lg shadow-blue-200 dark:shadow-black/30">
                      FR
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {item.status}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-950 dark:text-white">{item.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-2">
                  {item.steps.map((step) => (
                    <span
                      key={step}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    >
                      {step}
                    </span>
                  ))}
                  <span className="ml-auto text-sm font-semibold text-blue-700 transition group-hover:translate-x-1 dark:text-blue-300">
                    进入 →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
