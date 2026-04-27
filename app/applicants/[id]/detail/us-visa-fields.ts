type IntakeItemLike = { label?: string; value?: string }
export type UsVisaIntakeLike = { items?: IntakeItemLike[] }

const US_VISA_LABEL_ORDER: Array<{ keyword: string; rank: number }> = [
  { keyword: "姓名", rank: 10 },
  { keyword: "姓", rank: 11 },
  { keyword: "名", rank: 12 },
  { keyword: "中文名", rank: 13 },
  { keyword: "电报码", rank: 14 },
  { keyword: "出生", rank: 15 },
  { keyword: "护照", rank: 16 },
  { keyword: "AA码", rank: 17 },
  { keyword: "电话", rank: 30 },
  { keyword: "邮箱", rank: 31 },
  { keyword: "地址", rank: 32 },
  { keyword: "城市", rank: 33 },
  { keyword: "州", rank: 34 },
  { keyword: "邮编", rank: 35 },
  { keyword: "到达", rank: 50 },
  { keyword: "停留", rank: 51 },
  { keyword: "赴美", rank: 52 },
  { keyword: "旅行", rank: 53 },
  { keyword: "酒店", rank: 54 },
]

export function sortUsVisaLabels(labels: string[]) {
  const rankOf = (label: string) => {
    const hit = US_VISA_LABEL_ORDER.find((item) => label.includes(item.keyword))
    return hit ? hit.rank : 999
  }
  return [...labels].sort((a, b) => {
    const rankDiff = rankOf(a) - rankOf(b)
    if (rankDiff !== 0) return rankDiff
    return a.localeCompare(b, "zh-CN")
  })
}

export function collectDetectedUsVisaFieldLabels(
  parsedUsVisaFullIntake?: UsVisaIntakeLike,
  parsedUsVisaDetails?: {
    surname?: string
    birthYear?: string
    passportNumber?: string
    chineseName?: string
    telecodeSurname?: string
    telecodeGivenName?: string
  },
) {
  const labels = (parsedUsVisaFullIntake?.items || [])
    .filter((item) => String(item?.value || "").trim())
    .map((item) => String(item?.label || "").trim())
    .filter(Boolean)

  if (labels.length > 0) {
    return sortUsVisaLabels(Array.from(new Set(labels)))
  }

  const fallback = [
    parsedUsVisaDetails?.surname ? "姓" : "",
    parsedUsVisaDetails?.birthYear ? "出生年份" : "",
    parsedUsVisaDetails?.passportNumber ? "护照号" : "",
    parsedUsVisaDetails?.chineseName ? "中文名" : "",
    parsedUsVisaDetails?.telecodeSurname ? "姓氏电报码" : "",
    parsedUsVisaDetails?.telecodeGivenName ? "名字电报码" : "",
  ].filter(Boolean) as string[]
  return sortUsVisaLabels(fallback)
}
