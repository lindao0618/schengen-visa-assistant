"use client"

import { useMemo, useState } from "react"
import type { ChangeEvent } from "react"
import {
  AlertTriangle,
  ArrowUpDown,
  BadgeCheck,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Download,
  Filter,
  Landmark,
  ReceiptText,
  RefreshCw,
  Search,
  Undo2,
  WalletCards,
  XCircle,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

type OrderStatus = "completed" | "processing" | "pending" | "cancelled"

type Order = {
  id: string
  customer: string
  email: string
  amount: number
  status: OrderStatus
  date: string
  visaType: string
  country: string
  rail: string
}

const mockOrders: Order[] = [
  {
    id: "ORD-2026-1001",
    customer: "张三",
    email: "zhang.san@example.com",
    amount: 1299,
    status: "completed",
    date: "2026-04-15",
    visaType: "申根签证",
    country: "法国",
    rail: "Stripe HK",
  },
  {
    id: "ORD-2026-1002",
    customer: "李四",
    email: "li.si@example.com",
    amount: 1499,
    status: "processing",
    date: "2026-04-16",
    visaType: "申根签证",
    country: "德国",
    rail: "Wise GBP",
  },
  {
    id: "ORD-2026-1003",
    customer: "王五",
    email: "wang.wu@example.com",
    amount: 2299,
    status: "pending",
    date: "2026-04-17",
    visaType: "美国签证",
    country: "美国",
    rail: "Manual Wire",
  },
  {
    id: "ORD-2026-1004",
    customer: "赵六",
    email: "zhao.liu@example.com",
    amount: 1899,
    status: "cancelled",
    date: "2026-04-14",
    visaType: "英国签证",
    country: "英国",
    rail: "Stripe HK",
  },
  {
    id: "ORD-2026-1005",
    customer: "钱七",
    email: "qian.qi@example.com",
    amount: 1699,
    status: "completed",
    date: "2026-04-13",
    visaType: "申根签证",
    country: "意大利",
    rail: "Wise EUR",
  },
]

const statusConfig = {
  completed: {
    label: "已入账",
    icon: CheckCircle2,
    className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  },
  processing: {
    label: "清算中",
    icon: Clock3,
    className: "border-blue-400/20 bg-blue-400/10 text-blue-300",
  },
  pending: {
    label: "待确认",
    icon: AlertTriangle,
    className: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  },
  cancelled: {
    label: "已关闭",
    icon: XCircle,
    className: "border-red-400/20 bg-red-400/10 text-red-300",
  },
} satisfies Record<OrderStatus, { label: string; icon: typeof CheckCircle2; className: string }>

const billingActions: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Gateway", icon: Landmark },
  { label: "Reconcile", icon: RefreshCw },
  { label: "Risk", icon: BadgeCheck },
]

function StatusBadge({ status }: { status: OrderStatus }) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${config.className}`}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  )
}

function MetricPanel({
  icon: Icon,
  label,
  title,
  value,
  detail,
  live,
}: {
  icon: typeof ReceiptText
  label: string
  title: string
  value: string
  detail: string
  live?: boolean
}) {
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/5 bg-white/[0.02] p-5">
      {live ? <div className="absolute -bottom-10 left-8 h-24 w-24 rounded-full bg-emerald-400/10 blur-[50px]" /> : null}
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">{label}</div>
          <h2 className="mt-3 text-lg font-bold tracking-tight text-white">{title}</h2>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/5 bg-white/[0.03] text-white/70">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="relative mt-8 font-mono text-3xl font-bold tracking-tight text-white">{value}</div>
      <div className="relative mt-3 flex items-center gap-2 text-xs text-white/38">
        {live ? (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
        ) : null}
        {detail}
      </div>
    </div>
  )
}

export default function AdminOrdersClientPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filteredOrders, setFilteredOrders] = useState(mockOrders)

  const totalRevenue = useMemo(
    () => filteredOrders.reduce((sum, order) => (order.status === "cancelled" ? sum : sum + order.amount), 0),
    [filteredOrders],
  )
  const completedCount = filteredOrders.filter((order) => order.status === "completed").length
  const pendingCount = filteredOrders.filter((order) => order.status === "pending" || order.status === "processing").length
  const refundCount = filteredOrders.filter((order) => order.status === "cancelled").length

  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setSearchTerm(value)

    if (!value) {
      setFilteredOrders(mockOrders)
      return
    }

    const normalizedValue = value.toLowerCase()
    const filtered = mockOrders.filter(
      (order) =>
        order.id.toLowerCase().includes(normalizedValue) ||
        order.customer.toLowerCase().includes(normalizedValue) ||
        order.email.toLowerCase().includes(normalizedValue) ||
        order.visaType.toLowerCase().includes(normalizedValue) ||
        order.country.toLowerCase().includes(normalizedValue) ||
        order.rail.toLowerCase().includes(normalizedValue),
    )

    setFilteredOrders(filtered)
  }

  return (
    <div className="min-h-[calc(100vh-9rem)] rounded-[32px] border border-white/5 bg-black p-5 text-white md:p-7">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-black" />
      <section className="relative overflow-hidden rounded-[32px] border border-white/5 bg-[#080808] p-6 md:p-8">
        <div className="pointer-events-none absolute inset-x-12 bottom-0 h-px bg-white/10" />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">Global Billing Console</div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">全局账单控制台</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/42">
              统一查看订单收入、支付通道、退款队列与签证案件收款状态。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-5 text-sm font-bold text-white/75 transition active:scale-95">
              <Filter className="h-4 w-4" />
              筛选
            </button>
            <button type="button" className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-black transition active:scale-95">
              <Download className="h-4 w-4" />
              导出
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <MetricPanel
          icon={ReceiptText}
          label="Revenue Ledger"
          title="订单收入总账"
          value={`¥${totalRevenue.toLocaleString()}`}
          detail={`${completedCount} 笔已入账订单`}
          live
        />
        <MetricPanel
          icon={WalletCards}
          label="Payment Rails"
          title="支付通道清算"
          value={`${pendingCount}`}
          detail="Stripe / Wise / Wire 待同步"
        />
        <MetricPanel
          icon={Undo2}
          label="Refund Queue"
          title="退款与关闭队列"
          value={`${refundCount}`}
          detail="需运营复核后执行退款"
        />
      </section>

      <section className="mt-6 rounded-[32px] border border-white/5 bg-white/[0.02] p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              className="h-12 w-full rounded-2xl border border-white/5 bg-black/30 pl-11 pr-20 text-sm text-white outline-none placeholder:text-white/25"
              placeholder="账单搜索：订单编号、客户、邮箱、签证类型、国家或通道..."
              value={searchTerm}
              onChange={handleSearch}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-white/10 px-2 py-1 font-mono text-[10px] text-white/35">
              Cmd K
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {billingActions.map(({ label, icon: Icon }) => (
              <button key={label} type="button" className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] px-4 text-xs font-bold text-white/55 transition active:scale-95">
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/5 bg-black/25 p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">Settlement ID</div>
            <div className="mt-2 font-mono text-lg font-bold text-white">BILL-GL-20260501</div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-black/25 p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">Revenue Node</div>
            <div className="mt-2 font-mono text-lg font-bold text-white">NODE_BILLING_01</div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-black/25 p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">Clearing Window</div>
            <div className="mt-2 font-mono text-lg font-bold text-white">T+1 18:00</div>
          </div>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-[32px] border border-white/5 bg-white/[0.02]">
        <div className="flex flex-col gap-3 border-b border-white/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">Revenue Ledger</div>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-white">订单与收款明细</h2>
          </div>
          <div className="font-mono text-sm text-white/45">{filteredOrders.length} rows</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-white/5 bg-black/25 text-[10px] font-bold uppercase tracking-widest text-white/35">
              <tr>
                {["订单编号", "客户", "签证类型", "国家", "金额", "日期", "通道", "状态", "操作"].map((label) => (
                  <th key={label} className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {label}
                      {label !== "操作" ? <ArrowUpDown className="h-3 w-3" /> : null}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="transition hover:bg-white/[0.03]">
                  <td className="px-5 py-4 font-mono font-bold text-white">{order.id}</td>
                  <td className="px-5 py-4">
                    <div className="font-bold text-white">{order.customer}</div>
                    <div className="mt-1 font-mono text-xs text-white/35">{order.email}</div>
                  </td>
                  <td className="px-5 py-4 text-white/62">{order.visaType}</td>
                  <td className="px-5 py-4 text-white/62">{order.country}</td>
                  <td className="px-5 py-4 font-mono font-bold text-white">¥{order.amount.toLocaleString()}</td>
                  <td className="px-5 py-4 font-mono text-white/50">{order.date}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-white/[0.02] px-3 py-1.5 font-mono text-xs text-white/55">
                      <CreditCard className="h-3.5 w-3.5" />
                      {order.rail}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-5 py-4">
                    <button type="button" className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 px-3 text-xs font-bold text-white/65 transition active:scale-95">
                      <CircleDollarSign className="h-3.5 w-3.5" />
                      查看
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
