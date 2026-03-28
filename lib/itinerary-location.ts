function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function buildAliasMap(entries: Array<[string, string[]]>) {
  const map: Record<string, string> = {}

  for (const [english, aliases] of entries) {
    for (const alias of aliases) {
      map[alias] = english
    }
  }

  return map
}

const COUNTRY_MAP = buildAliasMap([
  [
    "France",
    [
      "\u6cd5\u56fd",
      "\u6cd5\u570b",
      "France",
      "france",
    ],
  ],
  [
    "United Kingdom",
    [
      "\u82f1\u56fd",
      "\u82f1\u570b",
      "\u82f1\u56fd\u672c\u571f",
      "United Kingdom",
      "UK",
      "uk",
      "Britain",
      "britain",
    ],
  ],
  [
    "China",
    [
      "\u4e2d\u56fd",
      "\u4e2d\u570b",
      "\u4e2d\u56fd\u5927\u9646",
      "China",
      "china",
    ],
  ],
  ["Italy", ["\u610f\u5927\u5229", "Italy", "italy"]],
  ["Spain", ["\u897f\u73ed\u7259", "Spain", "spain"]],
  ["Germany", ["\u5fb7\u56fd", "\u5fb7\u570b", "Germany", "germany"]],
  ["Netherlands", ["\u8377\u5170", "\u8377\u862d", "Netherlands", "netherlands"]],
  ["Belgium", ["\u6bd4\u5229\u65f6", "\u6bd4\u5229\u6642", "Belgium", "belgium"]],
  ["Switzerland", ["\u745e\u58eb", "Switzerland", "switzerland"]],
])

const CITY_MAP = buildAliasMap([
  ["London", ["\u4f26\u6566", "\u4f26\u6566\u5e02", "London", "london"]],
  ["Paris", ["\u5df4\u9ece", "\u5df4\u9ece\u5e02", "Paris", "paris"]],
  ["Edinburgh", ["\u7231\u4e01\u5821", "Edinburgh", "edinburgh"]],
  ["Manchester", ["\u66fc\u5f7b\u65af\u7279", "Manchester", "manchester"]],
  ["Lyon", ["\u91cc\u6602", "Lyon", "lyon"]],
  ["Marseille", ["\u9a6c\u8d5b", "\u99ac\u8cfd", "Marseille", "marseille"]],
  ["Nice", ["\u5c3c\u65af", "Nice", "nice"]],
  ["Cannes", ["\u620e\u7eb3", "\u621b\u7eb3", "Cannes", "cannes"]],
  ["Versailles", ["\u51e1\u5c14\u8d5b", "Versailles", "versailles"]],
  ["Rome", ["\u7f57\u9a6c", "\u7f85\u99ac", "Rome", "rome"]],
  ["Milan", ["\u7c73\u5170", "\u7c73\u862d", "Milan", "milan"]],
  ["Berlin", ["\u67cf\u6797", "Berlin", "berlin"]],
  ["Munich", ["\u6155\u5c3c\u9ed1", "Munich", "munich"]],
  ["Madrid", ["\u9a6c\u5fb7\u91cc", "\u99ac\u5fb7\u91cc", "Madrid", "madrid"]],
  ["Barcelona", ["\u5df4\u585e\u7f57\u90a3", "\u5df4\u585e\u9686\u7d0d", "Barcelona", "barcelona"]],
  ["Amsterdam", ["\u963f\u59c6\u65af\u7279\u4e39", "Amsterdam", "amsterdam"]],
  ["Brussels", ["\u5e03\u9c81\u585e\u5c14", "\u5e03\u9b6f\u585e\u723e", "Brussels", "brussels"]],
  ["Geneva", ["\u65e5\u5185\u74e6", "Geneva", "geneva"]],
  ["Zurich", ["\u82cf\u9ece\u4e16", "\u8607\u9ece\u4e16", "Zurich", "zurich"]],
  ["Shanghai", ["\u4e0a\u6d77", "\u4e0a\u6d77\u5e02", "Shanghai", "shanghai"]],
  ["Beijing", ["\u5317\u4eac", "\u5317\u4eac\u5e02", "Beijing", "beijing"]],
  ["Guangzhou", ["\u5e7f\u5dde", "\u5ee3\u5dde", "Guangzhou", "guangzhou"]],
  ["Shenzhen", ["\u6df1\u5733", "Shenzhen", "shenzhen"]],
  ["Hong Kong", ["\u9999\u6e2f", "Hong Kong", "hong kong", "hongkong"]],
])

export function toItineraryEnglishCountry(value: unknown) {
  const normalized = normalizeText(value)
  if (!normalized) return normalized
  return COUNTRY_MAP[normalized] || normalized
}

export function toItineraryEnglishCity(value: unknown) {
  const normalized = normalizeText(value)
  if (!normalized) return normalized
  return CITY_MAP[normalized] || normalized
}
