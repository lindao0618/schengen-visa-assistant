import fs from "fs/promises"
import path from "path"

import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { nanoid } from "nanoid"

import { authOptions } from "@/lib/auth"
import {
  COMPREHENSIVE_MATERIAL_CONFIG,
  type ComprehensiveMaterialKey,
  type ComprehensiveMaterialSource,
  runFranceComprehensiveReview,
} from "@/lib/comprehensive-material-review"
import {
  getApplicantProfile,
  getApplicantProfileFileByCandidates,
} from "@/lib/applicant-profiles"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const ARCHIVE_SLOT_CANDIDATES: Partial<Record<ComprehensiveMaterialKey, string[]>> = {
  schengenExcel: ["schengenExcel", "franceExcel"],
  fvReceipt: ["franceReceiptPdf"],
  itinerary: ["schengenItineraryPdf"],
  hotel: ["schengenHotelReservation"],
  flight: ["schengenFlightReservation"],
}

function getUploadedFile(formData: FormData, key: string) {
  const value = formData.get(key)
  return value && typeof value === "object" && "arrayBuffer" in value ? (value as File) : null
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "upload"
}

async function saveUploadToTemp(tempDir: string, key: string, file: File) {
  const targetPath = path.join(tempDir, `${key}-${Date.now()}-${sanitizeFileName(file.name)}`)
  await fs.writeFile(targetPath, Buffer.from(await file.arrayBuffer()))
  return targetPath
}

async function resolveMaterialSource(params: {
  key: ComprehensiveMaterialKey
  formData: FormData
  tempDir: string
  userId: string
  applicantProfileId: string
  role?: string
}) {
  const { key, formData, tempDir, userId, applicantProfileId, role } = params
  const config = COMPREHENSIVE_MATERIAL_CONFIG[key]
  const uploadedFile = getUploadedFile(formData, key)

  if (uploadedFile) {
    const absolutePath = await saveUploadToTemp(tempDir, key, uploadedFile)
    return {
      key,
      label: config.label,
      required: config.required,
      sourceType: "upload",
      fileName: uploadedFile.name,
      mimeType: uploadedFile.type,
      absolutePath,
    } satisfies ComprehensiveMaterialSource
  }

  const archiveSlots = ARCHIVE_SLOT_CANDIDATES[key]
  if (!archiveSlots?.length) return null

  const file = await getApplicantProfileFileByCandidates(
    userId,
    applicantProfileId,
    archiveSlots as Parameters<typeof getApplicantProfileFileByCandidates>[2],
    role,
  )
  if (!file) return null

  return {
    key,
    label: config.label,
    required: config.required,
    sourceType: "archive",
    fileName: file.meta.originalName,
    mimeType: file.meta.mimeType,
    absolutePath: file.absolutePath,
  } satisfies ComprehensiveMaterialSource
}

export async function POST(request: NextRequest) {
  const tempDir = path.join(process.cwd(), "temp", "comprehensive-material-review", nanoid(10))

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录后再使用综合材料审核" }, { status: 401 })
    }

    const formData = await request.formData()
    const applicantProfileId = String(formData.get("applicantProfileId") || "").trim()
    if (!applicantProfileId) {
      return NextResponse.json({ error: "请先选择申请人档案" }, { status: 400 })
    }

    const applicantProfile = await getApplicantProfile(session.user.id, applicantProfileId, session.user.role)
    if (!applicantProfile) {
      return NextResponse.json({ error: "当前申请人档案不存在或无权访问" }, { status: 404 })
    }

    await fs.mkdir(tempDir, { recursive: true })

    const materials: Partial<Record<ComprehensiveMaterialKey, ComprehensiveMaterialSource>> = {}
    for (const key of Object.keys(COMPREHENSIVE_MATERIAL_CONFIG) as ComprehensiveMaterialKey[]) {
      const source = await resolveMaterialSource({
        key,
        formData,
        tempDir,
        userId: session.user.id,
        applicantProfileId,
        role: session.user.role,
      })
      if (source) materials[key] = source
    }

    const result = await runFranceComprehensiveReview(materials)

    return NextResponse.json({
      success: true,
      applicant: {
        id: applicantProfile.id,
        name: applicantProfile.name || applicantProfile.label,
      },
      result,
    })
  } catch (error) {
    console.error("Comprehensive material review failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "综合材料审核失败" },
      { status: 500 },
    )
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}
