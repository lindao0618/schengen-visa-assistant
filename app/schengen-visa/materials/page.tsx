import Link from "next/link"

const SCHENGEN_COUNTRIES = [
  { slug: "france", label: "法国", code: "FR", note: "高频办理" },
  { slug: "germany", label: "德国", code: "DE", note: "商务/旅游" },
  { slug: "italy", label: "意大利", code: "IT", note: "旅游常用" },
  { slug: "spain", label: "西班牙", code: "ES", note: "假期热门" },
  { slug: "netherlands", label: "荷兰", code: "NL", note: "短途旅行" },
  { slug: "switzerland", label: "瑞士", code: "CH", note: "材料严格" },
  { slug: "austria", label: "奥地利", code: "AT", note: "行程清晰" },
  { slug: "belgium", label: "比利时", code: "BE", note: "探亲商务" },
  { slug: "portugal", label: "葡萄牙", code: "PT", note: "旅游路线" },
  { slug: "greece", label: "希腊", code: "GR", note: "海岛行程" },
]

export default function SchengenMaterialsPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_right,_#dcfce7,_transparent_28rem),linear-gradient(180deg,_#f8fafc,_#eef2ff)] px-4 py-10 dark:bg-[radial-gradient(circle_at_top_right,_rgba(22,101,52,0.24),_transparent_28rem),linear-gradient(180deg,_#020617,_#030712)]">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8 max-w-3xl">
          <p className="mb-3 inline-flex rounded-full border border-emerald-200 bg-white/75 px-3 py-1 text-sm font-medium text-emerald-700 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
            申根材料清单
          </p>
          <h1 className="text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            申根材料准备
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
            选择目标国家进入材料清单。专员可按国家差异核对材料，也方便把清单发给客户准备。
          </p>
        </div>

        <div className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-2xl shadow-emerald-100/70 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70 dark:shadow-black/30 sm:p-7">
          <div className="mb-6 flex flex-col gap-2 border-b border-slate-200 pb-5 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-950 dark:text-white">选择申根国家</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                不同国家材料要求略有差异，先选国家再进入对应清单。
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {SCHENGEN_COUNTRIES.length} 个国家
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {SCHENGEN_COUNTRIES.map((country) => (
              <Link
                key={country.slug}
                href={`/schengen-visa/materials/${country.slug}`}
                className="group rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-100 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950 dark:hover:border-emerald-700 dark:hover:shadow-black/40"
              >
                <div className="mb-5 flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white shadow-lg dark:bg-white dark:text-slate-950">
                    {country.code}
                  </span>
                  <span className="text-lg text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-500">
                    →
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">{country.label}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{country.note}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
