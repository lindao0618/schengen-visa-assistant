import Link from "next/link"

interface TicketBookingSite {
  name: string
  nameEn: string
  url: string
  description: string
  features: string[]
  color: string
  region: string
  type: "机票" | "火车"
}

const ticketBookingSites: TicketBookingSite[] = [
  {
    name: "欧洲之星",
    nameEn: "Eurostar",
    url: "https://www.eurostar.com",
    description: "连接伦敦与巴黎、布鲁塞尔、阿姆斯特丹等欧洲城市，申根行程材料常用。",
    features: ["伦敦直达欧洲", "2 小时到巴黎", "无需转机", "市中心出发"],
    color: "#003399",
    region: "英欧跨境",
    type: "火车",
  },
  {
    name: "携程",
    nameEn: "Ctrip",
    url: "https://www.ctrip.com",
    description: "适合中文服务、国内支付和机票行程单准备。",
    features: ["价格透明", "服务保障", "积分奖励", "24 小时客服"],
    color: "#1890FF",
    region: "中国优势",
    type: "机票",
  },
  {
    name: "去哪儿",
    nameEn: "Qunar",
    url: "https://www.qunar.com",
    description: "机票和火车票比价搜索，适合快速比较多个供应商报价。",
    features: ["比价搜索", "低价保障", "快速出票", "退改保障"],
    color: "#52C41A",
    region: "中国优势",
    type: "机票",
  },
  {
    name: "Expedia",
    nameEn: "Expedia",
    url: "https://www.expedia.com",
    description: "国际旅行预订网站，适合机票加酒店的套餐方案。",
    features: ["套餐优惠", "积分奖励", "价格保障", "移动应用"],
    color: "#FFC72C",
    region: "全球",
    type: "机票",
  },
  {
    name: "Skyscanner",
    nameEn: "Skyscanner",
    url: "https://www.skyscanner.com",
    description: "全球机票比价搜索引擎，适合找低价和灵活日期。",
    features: ["价格比较", "灵活日期", "价格提醒", "最佳时机"],
    color: "#0770E3",
    region: "全球",
    type: "机票",
  },
  {
    name: "飞猪",
    nameEn: "Fliggy",
    url: "https://www.fliggy.com",
    description: "阿里旗下旅行平台，适合国内用户支付和出票习惯。",
    features: ["阿里生态", "信用住", "花呗分期", "芝麻信用"],
    color: "#FF6A00",
    region: "中国优势",
    type: "机票",
  },
]

export default function TicketBookingPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#fef3c7,_transparent_30rem),linear-gradient(180deg,_#f8fafc,_#eef2ff)] px-4 py-10">
      <section className="mx-auto max-w-6xl">
        <Link
          href="/material-customization"
          className="mb-6 inline-flex rounded-full border border-amber-200 bg-white/80 px-4 py-2 text-sm font-semibold text-amber-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
        >
          ← 返回定制材料
        </Link>

        <header className="mb-8 text-center">
          <p className="mb-4 inline-flex rounded-full border border-amber-200 bg-white/75 px-4 py-1 text-sm font-semibold text-amber-700">
            行程交通导航
          </p>
          <h1 className="text-4xl font-black tracking-tight text-slate-950">机票/车票预订服务</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            为客户准备签证材料时，快速比较机票、火车票和跨境交通平台，保证行程逻辑清晰。
          </p>
        </header>

        <section className="mb-8 rounded-[2rem] border border-amber-100 bg-white/85 p-5 shadow-xl shadow-amber-100/60">
          <h2 className="text-xl font-bold text-slate-950">预订小贴士</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
            <p>用于签证材料时，交通预订单日期、城市和停留顺序需要与行程表保持一致。</p>
            <p>建议查看退改签政策、行李规定和出票确认方式，避免递签前材料失效。</p>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {ticketBookingSites.map((site) => (
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
                立即前往预订 →
              </a>
            </article>
          ))}
        </section>
      </section>
    </main>
  )
}
