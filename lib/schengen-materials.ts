/** 申根各国材料清单：非法国国家使用静态数据；法国可用 API /api/schengen/france/checklist */

export interface MaterialItem {
  id: string
  name: string
  description: string
  example?: string
}

export interface CountryChecklist {
  required: MaterialItem[]
  optional: MaterialItem[]
}

const DEFAULT_REQUIRED: MaterialItem[] = [
  { id: "passport", name: "有效护照", description: "有效期超过预计离开申根区日期6个月以上，至少两页空白页" },
  { id: "application_form", name: "申根签证申请表", description: "完整填写并签名" },
  { id: "photo", name: "近期彩色照片", description: "3.5cm x 4.5cm，白色背景" },
  { id: "insurance", name: "旅行医疗保险", description: "最低保额30,000欧元，覆盖整个申根区" },
  { id: "flight_reservation", name: "往返机票预订单", description: "确认的往返机票预订" },
  { id: "accommodation", name: "住宿证明", description: "酒店预订或住宿确认" },
  { id: "bank_statement", name: "银行对账单", description: "最近3个月的银行流水" },
  { id: "employment_letter", name: "在职证明", description: "公司出具的在职证明信" },
]

const DEFAULT_OPTIONAL: MaterialItem[] = [
  { id: "salary_slips", name: "工资单", description: "最近3个月的工资单" },
  { id: "hukou", name: "户口本复印件", description: "全本户口本复印件" },
  { id: "marriage_cert", name: "结婚证", description: "如已婚需提供" },
  { id: "invitation_letter", name: "邀请函", description: "如适用" },
]

const STATIC_CHECKLISTS: Record<string, CountryChecklist> = {
  germany: {
    required: [...DEFAULT_REQUIRED],
    optional: [...DEFAULT_OPTIONAL],
  },
  italy: {
    required: [...DEFAULT_REQUIRED],
    optional: [...DEFAULT_OPTIONAL],
  },
  spain: {
    required: [...DEFAULT_REQUIRED],
    optional: [...DEFAULT_OPTIONAL],
  },
  netherlands: {
    required: [...DEFAULT_REQUIRED],
    optional: [...DEFAULT_OPTIONAL],
  },
  switzerland: {
    required: [...DEFAULT_REQUIRED],
    optional: [...DEFAULT_OPTIONAL],
  },
  austria: {
    required: [...DEFAULT_REQUIRED],
    optional: [...DEFAULT_OPTIONAL],
  },
  belgium: {
    required: [...DEFAULT_REQUIRED],
    optional: [...DEFAULT_OPTIONAL],
  },
  portugal: {
    required: [...DEFAULT_REQUIRED],
    optional: [...DEFAULT_OPTIONAL],
  },
  greece: {
    required: [...DEFAULT_REQUIRED],
    optional: [...DEFAULT_OPTIONAL],
  },
}

const COUNTRY_LABELS: Record<string, string> = {
  france: "法国",
  germany: "德国",
  italy: "意大利",
  spain: "西班牙",
  netherlands: "荷兰",
  switzerland: "瑞士",
  austria: "奥地利",
  belgium: "比利时",
  portugal: "葡萄牙",
  greece: "希腊",
}

export function getCountryLabel(slug: string): string {
  return COUNTRY_LABELS[slug] ?? slug
}

export function getStaticChecklist(countrySlug: string): CountryChecklist | null {
  return STATIC_CHECKLISTS[countrySlug] ?? null
}

export function isFrance(countrySlug: string): boolean {
  return countrySlug === "france"
}
