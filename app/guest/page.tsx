import Link from "next/link"

const visaSections = [
  {
    name: "申根签证",
    tone: "emerald",
    description: "适合英国留学生圣诞、复活节和短途欧洲旅行。",
    cards: [
      {
        title: "签证概览",
        detail: "申根签证通常支持在申根区短期旅行、商务或学习，常见停留上限为 90 天。",
        points: ["覆盖多个欧洲国家", "按主要停留国申请", "需准备行程与保险"],
      },
      {
        title: "申请流程",
        detail: "先确定目的地和申请国家，再准备材料、预约递签、提交并等待审核。",
        points: ["确认签证中心", "整理材料清单", "预约递交时间"],
      },
      {
        title: "常见材料",
        detail: "不同国家略有差异，但基础材料通常包括护照、照片、行程、住宿和资金证明。",
        points: ["有效护照与照片", "机票住宿预订单", "银行流水与在读证明"],
      },
    ],
  },
  {
    name: "美国签证",
    tone: "blue",
    description: "适合旅游、商务、探亲和学生面签准备。",
    cards: [
      {
        title: "DS-160",
        detail: "先完成 DS-160 信息填写，再进入预约和缴费流程。",
        points: ["护照与旅行计划", "教育工作经历", "联系人与安全问题"],
      },
      {
        title: "面签准备",
        detail: "重点准备出行目的、资金来源、英国学习或工作约束力说明。",
        points: ["清晰行程目的", "资金和身份材料", "常见问题演练"],
      },
      {
        title: "预约节点",
        detail: "根据使领馆放号情况预约面签，材料需和 DS-160 信息保持一致。",
        points: ["缴费后预约", "确认 DS-160 编号", "携带预约确认页"],
      },
    ],
  },
  {
    name: "日本签证",
    tone: "amber",
    description: "适合短期旅游、探亲访友和商务访问。",
    cards: [
      {
        title: "申请路径",
        detail: "通常通过指定代理或签证中心提交，材料要求更依赖申请人所在地。",
        points: ["确认受理范围", "选择递交渠道", "核对停留天数"],
      },
      {
        title: "材料重点",
        detail: "行程、住宿、资金证明和在英身份材料需要保持逻辑一致。",
        points: ["行程表", "住宿证明", "BRP/签证身份证明"],
      },
      {
        title: "审核关注",
        detail: "审核会关注旅行目的、回英约束力、资金稳定性和历史出入境记录。",
        points: ["目的明确", "资金稳定", "按期返回英国"],
      },
    ],
  },
]

const benefits = ["个性化申请指导", "进度跟踪", "文件清单和提醒", "AI 助手即时答疑"]

export default function GuestPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.24),_transparent_28rem),linear-gradient(180deg,_#020617,_#09090b)] px-4 py-12 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <p className="mb-4 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1 text-sm font-semibold text-emerald-200">
            游客模式
          </p>
          <h1 className="text-4xl font-black tracking-tight md:text-5xl">签证信息（游客模式）</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-300">
            先浏览主要签证类型和申请重点。注册后可使用专员工作台、材料清单、进度跟踪和自动化工具。
          </p>
        </div>

        <div className="grid gap-6">
          {visaSections.map((section) => (
            <section
              key={section.name}
              className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur sm:p-7"
            >
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{section.name}</h2>
                  <p className="mt-1 text-sm text-zinc-400">{section.description}</p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-sm text-zinc-300">
                  {section.cards.length} 个重点
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {section.cards.map((card) => (
                  <article
                    key={card.title}
                    className="rounded-3xl border border-white/10 bg-zinc-950/70 p-5 transition hover:-translate-y-0.5 hover:border-emerald-400/40"
                  >
                    <h3 className="text-lg font-bold">{card.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-300">{card.detail}</p>
                    <ul className="mt-4 space-y-2 text-sm text-zinc-400">
                      {card.points.map((point) => (
                        <li key={point} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-8 rounded-[2rem] border border-emerald-400/20 bg-emerald-400/10 p-6 sm:p-8">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h2 className="text-2xl font-bold">注册账户后可以继续完成申请</h2>
              <div className="mt-4 grid gap-2 text-sm text-emerald-50 sm:grid-cols-2">
                {benefits.map((benefit) => (
                  <div key={benefit} className="rounded-2xl bg-white/10 px-4 py-3">
                    {benefit}
                  </div>
                ))}
              </div>
            </div>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-bold text-zinc-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-50"
            >
              立即注册 →
            </Link>
          </div>
        </section>
      </section>
    </main>
  )
}
