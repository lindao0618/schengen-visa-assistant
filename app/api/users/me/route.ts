import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import bcrypt from "bcryptjs"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"

async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { session: null, user: null }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  return { session, user }
}

export async function GET(_req: NextRequest) {
  const { user } = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const { password, ...userInfo } = user
  return NextResponse.json(userInfo)
}

export async function PUT(req: NextRequest) {
  const { session, user } = await getCurrentUser()
  if (!session?.user?.id || !user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const rawName = typeof body?.name === "string" ? body.name.trim() : ""
    if (!rawName) {
      return NextResponse.json({ error: "名称不能为空" }, { status: 400 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { name: rawName },
    })

    const { password, ...userInfo } = updatedUser
    return NextResponse.json({ message: "名称更新成功", user: userInfo })
  } catch (error) {
    console.error("[API_USERS_ME_PUT]", error)
    return NextResponse.json({ error: "更新用户资料失败" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const { session, user } = await getCurrentUser()
  if (!session?.user?.id || !user) {
    return NextResponse.json({ error: "未登录或会话无效" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "当前密码和新密码均为必填项" }, { status: 400 })
    }

    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return NextResponse.json({ error: "新密码长度至少为6位" }, { status: 400 })
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
    if (!isCurrentPasswordValid) {
      return NextResponse.json({ error: "当前密码不正确" }, { status: 400 })
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashedNewPassword },
    })

    return NextResponse.json({ message: "密码更新成功" }, { status: 200 })
  } catch (error) {
    console.error("[API_USERS_ME_PATCH_PASSWORD]", error)
    return NextResponse.json({ error: "服务器内部错误，密码更新失败" }, { status: 500 })
  }
}
