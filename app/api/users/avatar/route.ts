import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import path from "path"
import fs from "fs/promises"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user?.email) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get("avatar") as File
  if (!file) {
    return NextResponse.json({ error: "未上传文件" }, { status: 400 })
  }

  // 生成唯一文件名
  const ext = file.name.split(".").pop()
  const fileName = `${session.user.email.replace(/[^a-zA-Z0-9]/g, "")}_${Date.now()}.${ext}`
  const uploadDir = path.join(process.cwd(), "public", "uploads", "avatar")
  await fs.mkdir(uploadDir, { recursive: true })
  const filePath = path.join(uploadDir, fileName)

  // 保存文件
  const arrayBuffer = await file.arrayBuffer()
  await fs.writeFile(filePath, Buffer.from(arrayBuffer))

  // 更新数据库
  const imageUrl = `/uploads/avatar/${fileName}`
  await prisma.user.update({
    where: { email: session.user.email },
    data: { image: imageUrl }
  })

  return NextResponse.json({ image: imageUrl })
}
