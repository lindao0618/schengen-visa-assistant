import Link from "next/link"

interface HotelBookingSite {
  name: string
  nameEn: string
  url: string
  description: string
  features: string[]
  color: string
  region: string
}

const hotelBookingSites: HotelBookingSite[] = [
  {
    name: "Booking.com",
    nameEn: "Booking.com",
    url: "https://www.booking.com",
    description: "全球最大的酒店预订平台，覆盖 230 多个国家和地区。",
    features: ["免费取消", "最低价保证", "真实评价", "24/7 客服"],
    color: "#003580",
    region: "全球",
  },
  {
    name: "携程",
    nameEn: "Trip.com",
    url: "https://www.trip.com",
    description: "中国领先的在线旅行服务公司，适合中文客服和国内支付偏好。",
    features: ["中文客服", "银联支付", "积分返现", "会员价"],
    color: "#1890ff",
    region: "全球",
  },
  {
    name: "Agoda",
    nameEn: "Agoda",
    url: "https://www.agoda.com",
    description: "亚洲酒店资源丰富，适合亚洲目的地比价和快速预订。",
    features: ["亚洲优势", "会员折扣", "快速预订", "价格匹配"],
    color: "#ff6b35",
    region: "亚洲优势",
  },
  {
    name: "Expedia",
    nameEn: "Expedia",
    url: "https://www.expedia.com",
    description: "国际旅行预订网站，适合酒店加机票的组合方案。",
    features: ["套餐优惠", "积分奖励", "价格预警", "移动应用"],
    color: "#ffd200",
    region: "全球",
  },
  {
    name: "Hotels.com",
    nameEn: "Hotels.com",
    url: "https://www.hotels.com",
    description: "专业酒店预订平台，适合经常出行用户比较会员权益。",
    features: ["住 10 送 1", "秘密价格", "24 小时客服", "价格保证"],
    color: "#d32f2f",
    region: "全球",
  },
  {
    name: "Airbnb",
    nameEn: "Airbnb",
    url: "https://www.airbnb.com",
    description: "全球民宿短租平台，适合长住、家庭出行和当地体验。",
    features: ["民宿特色", "当地体验", "长住优惠", "房东沟通"],
    color: "#ff5a5f",
    region: "全球",
  },
]

const relatedServices = [
  { title: "机票预订", description: "后续可接入机票比价和预订服务。" },
  { title: "旅游攻略", description: "目的地攻略和旅行规划建议。" },
  { title: "签证服务", description: "与材料清单、行程和酒店预订单联动。" },
]

export default function HotelBookingPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_30rem),linear-gradient(180deg,_#f8fafc,_#e5e7eb)] px-4 py-10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.2),_transparent_30rem),linear-gradient(180deg,_#020617,_#111827)]">
      <section className="mx-auto max-w-6xl">
        <div className="mb-6">
          <Link
            href="/material-customization"
            className="inline-flex rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200"
          >
            ← 返回定制材料
          </Link>
        </div>

        <header className="mb-10 text-center">
          <p className="mb-4 inline-flex rounded-full border border-blue-200 bg-white/75 px-4 py-1 text-sm font-semibold text-blue-700 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
            酒店预订导航
          </p>
          <h1 className="text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            酒店预订服务
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
            为客户准备签证材料时，快速比较常用酒店预订平台，找到适合行程和预算的住宿。
          </p>
        </header>

        <section className="mb-8 rounded-[2rem] border border-blue-100 bg-white/85 p-5 shadow-xl shadow-blue-100/60 backdrop-blur dark:border-blue-950 dark:bg-slate-950/70 dark:shadow-black/30">
          <h2 className="text-xl font-bold text-slate-950 dark:text-white">预订小贴士</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-2">
            <p>建议多个平台比价，重点确认取消政策、入住条款和是否支持免费取消。</p>
            <p>用于签证材料时，酒店预订单的姓名、日期、城市应与行程单和机票逻辑一致。</p>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {hotelBookingSites.map((site) => (
            <article
              key={site.name}
              className="flex min-h-64 flex-col rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-200/70 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-2xl dark:border-slate-800 dark:bg-slate-950/70 dark:shadow-black/30"
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: site.color }} />
                  <div>
                    <h2 className="font-bold text-slate-950 dark:text-white">{site.name}</h2>
                    <p className="text-xs text-slate-500">{site.nameEn}</p>
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {site.region}
                </span>
              </div>
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{site.description}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {site.features.map((feature) => (
                  <span
                    key={feature}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
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

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {relatedServices.map((service) => (
            <article
              key={service.title}
              className="rounded-3xl border border-slate-200 bg-white/80 p-5 text-center dark:border-slate-800 dark:bg-slate-950/70"
            >
              <h3 className="font-bold text-slate-950 dark:text-white">{service.title}</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{service.description}</p>
            </article>
          ))}
        </section>

        <p className="mt-8 rounded-2xl bg-white/75 p-4 text-center text-xs text-slate-500 dark:bg-slate-950/70 dark:text-slate-400">
          免责声明：本页面仅提供酒店预订网站导航服务，具体预订条款和价格以各预订平台为准，请在预订前阅读相关条款。
        </p>
      </section>
    </main>
  )
}
