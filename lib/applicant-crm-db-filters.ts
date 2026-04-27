import type { Prisma } from "@prisma/client"

type ApplicantCrmKeywordWhereOptions = {
  includeStats?: boolean
  includeProfiles?: boolean
  includeSelectorCases?: boolean
}

function normalizeKeyword(value: string | undefined) {
  return typeof value === "string" ? value.trim() : ""
}

function isEmptyWhere(where: Prisma.ApplicantProfileWhereInput) {
  return Object.keys(where).length === 0
}

function buildKeywordWhere(keyword: string): Prisma.ApplicantProfileWhereInput {
  const textFilter = { contains: keyword, mode: "insensitive" as const }
  return {
    OR: [
      { name: textFilter },
      { phone: textFilter },
      { email: textFilter },
      { wechat: textFilter },
      { passportNumber: textFilter },
      { usVisaPassportNumber: textFilter },
    ],
  }
}

export function shouldUseApplicantCrmKeywordWhere(options: ApplicantCrmKeywordWhereOptions) {
  return !options.includeStats && !options.includeProfiles && !options.includeSelectorCases
}

export function buildApplicantCrmListWhere(
  accessWhere: Prisma.ApplicantProfileWhereInput,
  keyword: string | undefined,
) {
  const normalizedKeyword = normalizeKeyword(keyword)
  if (!normalizedKeyword) return accessWhere

  const keywordWhere = buildKeywordWhere(normalizedKeyword)
  if (isEmptyWhere(accessWhere)) return keywordWhere
  return {
    AND: [accessWhere, keywordWhere],
  } satisfies Prisma.ApplicantProfileWhereInput
}
