import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"

function isApplicantProfileSchemaMismatch(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
    return true
  }

  const message = error instanceof Error ? error.message : String(error ?? "")
  return /schengenVisaCity|schengenFraNumber/i.test(message) || (/ApplicantProfile/i.test(message) && /column/i.test(message))
}

export function handleApplicantProfileApiError(error: unknown) {
  console.error("[applicants-api]", error)
  const detail = error instanceof Error ? error.message : String(error ?? "")
  const includeDetail = process.env.NODE_ENV !== "production"

  if (isApplicantProfileSchemaMismatch(error)) {
    const baseMessage = "申请人档案数据结构已更新，请先执行数据库迁移：npx prisma migrate deploy"
    return NextResponse.json(
      {
        error: includeDetail ? `${baseMessage} | ${detail}` : baseMessage,
        code: "APPLICANT_PROFILE_SCHEMA_OUTDATED",
        ...(includeDetail ? { detail } : {}),
      },
      { status: 500 }
    )
  }

  const genericMessage = "申请人档案接口处理失败，请查看服务端日志"
  return NextResponse.json(
    {
      error: includeDetail ? `${genericMessage} | ${detail}` : genericMessage,
      code: "APPLICANT_PROFILE_API_ERROR",
      ...(includeDetail ? { detail } : {}),
    },
    { status: 500 }
  )
}
