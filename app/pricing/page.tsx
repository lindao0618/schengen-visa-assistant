import Link from "next/link"

const plans = [
  {
    name: "基础版",
    monthly: 99,
    description: "适合个人签证申请",
    features: ["基础签证指南", "申请材料清单", "社区基础访问权限", "基础 AI 助手支持"],
    badge: "",
  },
  {
    name: "专业版",
    monthly: 299,
    description: "适合经常出国的用户",
    features: ["所有基础版功能", "优先 AI 助手支持", "材料专业审核", "预约加急服务", "签证面试模拟"],
    badge: "最受欢迎",
  },
  {
    name: "商务版",
    monthly: 999,
    description: "适合企业和团队",
    features: ["所有专业版功能", "团队成员管理", "专属客服支持", "批量签证办理", "加急通道", "团队折扣"],
    badge: "企业优选",
  },
]

const features = [
  { name: "基础签证指南", basic: true, pro: true, business: true },
  { name: "申请材料清单", basic: true, pro: true, business: true },
  { name: "社区访问权限", basic: true, pro: true, business: true },
  { name: "AI 助手支持", basic: "基础", pro: "优先", business: "24/7 专属" },
  { name: "材料审核", basic: false, pro: true, business: true },
  { name: "预约加急服务", basic: false, pro: true, business: true },
  { name: "签证面试模拟", basic: false, pro: true, business: true },
  { name: "团队成员管理", basic: false, pro: false, business: true },
  { name: "专属客服支持", basic: false, pro: false, business: true },
  { name: "批量签证办理", basic: false, pro: false, business: true },
]

const serviceHighlights = [
  { title: "快速处理", detail: "加急通道确保申请得到优先处理" },
  { title: "安全保障", detail: "全程保护客户个人信息和申请资料" },
  { title: "专业支持", detail: "经验丰富的签证团队提供审核建议" },
  { title: "企业定制", detail: "为团队客户提供定制化流程和权限" },
]

const faqs = [
  {
    question: "如何选择适合我的套餐？",
    answer: "个人单次申请建议基础版；需要材料审核和更高服务优先级建议专业版；机构或团队建议商务版。",
  },
  {
    question: "可以随时更换套餐吗？",
    answer: "可以升级或降级套餐。升级可立即生效，降级通常在当前计费周期结束后生效。",
  },
  {
    question: "是否提供退款？",
    answer: "支持 7 天无理由退款。如果购买后发现服务不匹配，可以在期限内申请处理。",
  },
  {
    question: "商务版可以添加多少团队成员？",
    answer: "商务版基础包含 10 名团队成员，更多席位可以按机构规模定制。",
  },
]

function renderFeatureValue(value: boolean | string) {
  if (typeof value === "string") return value
  return value ? "包含" : "不包含"
}

export default function PricingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.22),_transparent_30rem),linear-gradient(180deg,_#020617,_#09090b)] px-4 py-16 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <p className="mb-4 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1 text-sm font-semibold text-emerald-200">
            SaaS 套餐
          </p>
          <h1 className="text-4xl font-black tracking-tight md:text-5xl">选择适合您的方案</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-300">
            所有套餐都包含核心签证申请能力。年付按 10 个月计费，相当于省 20%。
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className="relative rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 backdrop-blur transition hover:-translate-y-0.5 hover:border-emerald-400/40"
            >
              {plan.badge ? (
                <span className="absolute right-5 top-5 rounded-full bg-emerald-400 px-3 py-1 text-xs font-black text-zinc-950">
                  {plan.badge}
                </span>
              ) : null}
              <h2 className="text-2xl font-bold">{plan.name}</h2>
              <p className="mt-2 text-sm text-zinc-400">{plan.description}</p>
              <div className="mt-6 grid gap-3 rounded-3xl border border-white/10 bg-zinc-950/70 p-4">
                <div>
                  <span className="text-4xl font-black">¥{plan.monthly}</span>
                  <span className="text-zinc-400">/月付</span>
                </div>
                <div className="rounded-2xl bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-200">
                  年付 ¥{plan.monthly * 10}/年
                </div>
              </div>
              <ul className="mt-6 space-y-3 text-sm text-zinc-300">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="mt-1 h-5 w-5 shrink-0 rounded-full bg-emerald-400/15 text-center text-xs leading-5 text-emerald-300">
                      ✓
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-emerald-400 px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-emerald-300"
              >
                选择{plan.name}
              </Link>
            </article>
          ))}
        </div>

        <section className="mt-14 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur sm:p-7">
          <h2 className="mb-5 text-center text-2xl font-bold">功能对比</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-zinc-400">
                  <th className="border-b border-white/10 px-4 py-3">功能</th>
                  <th className="border-b border-white/10 px-4 py-3">基础版</th>
                  <th className="border-b border-white/10 px-4 py-3">专业版</th>
                  <th className="border-b border-white/10 px-4 py-3">商务版</th>
                </tr>
              </thead>
              <tbody>
                {features.map((feature) => (
                  <tr key={feature.name} className="text-zinc-200">
                    <td className="border-b border-white/10 px-4 py-3 font-medium">{feature.name}</td>
                    <td className="border-b border-white/10 px-4 py-3">{renderFeatureValue(feature.basic)}</td>
                    <td className="border-b border-white/10 px-4 py-3">{renderFeatureValue(feature.pro)}</td>
                    <td className="border-b border-white/10 px-4 py-3">{renderFeatureValue(feature.business)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {serviceHighlights.map((item) => (
            <article key={item.title} className="rounded-3xl border border-white/10 bg-zinc-950/70 p-5">
              <h3 className="font-bold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{item.detail}</p>
            </article>
          ))}
        </section>

        <section className="mx-auto mt-14 max-w-3xl">
          <h2 className="mb-5 text-center text-2xl font-bold">常见问题</h2>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <details key={faq.question} className="group rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <summary className="cursor-pointer list-none font-semibold text-white">
                  {faq.question}
                  <span className="float-right text-emerald-300">+</span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-[2rem] border border-emerald-400/20 bg-emerald-400/10 p-8 text-center">
          <h2 className="text-2xl font-bold">需要企业定制方案？</h2>
          <p className="mx-auto mt-3 max-w-xl text-zinc-200">如果后续给其他签证机构使用，可以按机构、角色、席位和自动化任务量定制。</p>
          <Link
            href="/enterprise"
            className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-black text-zinc-950 transition hover:bg-emerald-50"
          >
            查看企业方案
          </Link>
        </section>
      </section>
    </main>
  )
}
