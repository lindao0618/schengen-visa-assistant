import Link from "next/link"

interface InsuranceSite {
  name: string
  nameEn: string
  url: string
  description: string
  features: string[]
  color: string
  region: string
  type: "全面保障" | "经济实惠" | "高端保障"
}

const insuranceSites: InsuranceSite[] = [
  {
    name: "Coverwise",
    nameEn: "Coverwise",
    url: "https://www.coverwise.co.uk",
    description: "英国旅游保险比价平台，适合在英客户准备申根签证保险。",
    features: ["申根签证认证", "医疗保障全面", "24 小时救援", "在线理赔"],
    color: "#1976D2",
    region: "英国/欧洲",
    type: "全面保障",
  },
  {
    name: "安联保险",
    nameEn: "Allianz Travel",
    url: "https://www.allianz-travel.com",
    description: "全球保险品牌，适合需要国际理赔和更高保障额度的客户。",
    features: ["全球理赔", "医疗费用高", "紧急救援", "行李保障"],
    color: "#0033A0",
    region: "全球",
    type: "高端保障",
  },
  {
    name: "中国人保",
    nameEn: "PICC Travel Insurance",
    url: "https://www.epicc.com.cn",
    description: "适合偏好中文服务和国内保险公司的境外旅游保险方案。",
    features: ["中文服务", "申根认证", "快速理赔", "价格优惠"],
    color: "#E53935",
    region: "中国",
    type: "全面保障",
  },
  {
    name: "World Nomads",
    nameEn: "World Nomads",
    url: "https://www.worldnomads.com",
    description: "面向背包客和长线旅行者，适合灵活旅行和特殊行程。",
    features: ["灵活保障", "极限运动", "在线购买", "全球覆盖"],
    color: "#FF6B35",
    region: "全球",
    type: "全面保障",
  },
  {
    name: "太平洋保险",
    nameEn: "CPIC Travel",
    url: "https://www.cpic.com.cn",
    description: "境外旅游保险性价比较高，适合预算敏感型客户。",
    features: ["境外医疗", "意外保障", "财产保险", "便民理赔"],
    color: "#4CAF50",
    region: "中国",
    type: "经济实惠",
  },
  {
    name: "AXA Travel",
    nameEn: "AXA Travel Insurance",
    url: "https://www.axa-travel-insurance.co.uk",
    description: "欧洲旅行保险常用品牌，适合申根旅行保险材料准备。",
    features: ["欧洲专业", "医疗无上限", "多语言服务", "快速审核"],
    color: "#8E24AA",
    region: "欧洲",
    type: "高端保障",
  },
]

export default function InsuranceComparisonPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_30rem),linear-gradient(180deg,_#f8fafc,_#eef2ff)] px-4 py-10">
      <section className="mx-auto max-w-6xl">
        <Link
          href="/material-customization"
          className="mb-6 inline-flex rounded-full border border-blue-200 bg-white/80 px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
        >
          ← 返回定制材料
        </Link>

        <header className="mb-8 text-center">
          <p className="mb-4 inline-flex rounded-full border border-blue-200 bg-white/75 px-4 py-1 text-sm font-semibold text-blue-700">
            申根保险导航
          </p>
          <h1 className="text-4xl font-black tracking-tight text-slate-950">旅游保险比较服务</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            为客户快速定位常用旅游保险平台，核对申根签证所需的医疗保障额度和覆盖区域。
          </p>
        </header>

        <section className="mb-8 rounded-[2rem] border border-blue-100 bg-white/85 p-5 shadow-xl shadow-blue-100/60">
          <h2 className="text-xl font-bold text-slate-950">保险选择小贴士</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
            <p>申根签证通常要求医疗保险最低 3 万欧元保障，并覆盖完整申根区域和旅行期间。</p>
            <p>建议核对紧急医疗救援、免赔额、理赔流程，以及保险单姓名和旅行日期是否一致。</p>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {insuranceSites.map((site) => (
            <article
              key={site.name}
              className="flex min-h-64 flex-col rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-200/70 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-2xl"
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: site.color }} />
                  <div>
                    <h2 className="font-bold text-slate-950">{site.name}</h2>
                    <p className="text-xs text-slate-500">{site.nameEn}</p>
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {site.type}
                </span>
              </div>
              <p className="text-sm leading-6 text-slate-600">{site.description}</p>
              <p className="mt-3 text-xs font-semibold text-slate-500">服务区域：{site.region}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {site.features.map((feature) => (
                  <span
                    key={feature}
                    className="rounded-full border bg-white px-3 py-1 text-xs"
                    style={{ borderColor: site.color, color: site.color }}
                  >
                    {feature}
                  </span>
                ))}
              </div>
              <a
                href={site.url}
                target="_blank"
                rel="noreferrer"
                className="mt-auto inline-flex justify-center rounded-full px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5"
                style={{ backgroundColor: site.color }}
              >
                立即了解保险 →
              </a>
            </article>
          ))}
        </section>
      </section>
    </main>
  )
}
