import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"

import { APP_ROLE_VALUES, normalizeAppRole } from "@/lib/access-control"
import { buildStoredRoleWhere } from "@/lib/access-control-server"
import { adminForbiddenResponse, getAdminSession, getBossSession } from "@/lib/admin-auth"
import prisma from "@/lib/db"
import { isPublicUiPreviewEnabled } from "@/lib/public-ui-preview"
import { getPublicUiPreviewAdminData } from "@/lib/public-ui-preview-admin-data"

export async function GET(request: NextRequest) {
  if (isPublicUiPreviewEnabled()) {
    return NextResponse.json(getPublicUiPreviewAdminData("users"))
  }

  const session = await getAdminSession()
  if (!session) return adminForbiddenResponse()

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")?.trim() || ""
    const status = searchParams.get("status") || "all"
    const role = searchParams.get("role") || "all"
    const page = Number(searchParams.get("page") || "1")
    const pageSize = Math.min(Number(searchParams.get("pageSize") || "20"), 100)

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ]
    }
    if (status !== "all") where.status = status

    const roleWhere = buildStoredRoleWhere(role)
    if (roleWhere) Object.assign(where, roleWhere)

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              usVisaTasks: true,
              frenchVisaTasks: true,
              documents: true,
              applications: true,
            },
          },
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      total,
      users: users.map((user) => ({
        ...user,
        role: normalizeAppRole(user.role),
      })),
    })
  } catch (error) {
    console.error("获取用户列表失败:", error)
    return NextResponse.json(
      { success: false, message: "获取用户列表失败" },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getBossSession()
  if (!session) return adminForbiddenResponse()

  try {
    const body = await request.json()
    const userId = body?.userId as string | undefined
    const status = body?.status as string | undefined
    const role = body?.role as string | undefined
    const name = body?.name as string | undefined
    const password = body?.password as string | undefined
    const nextRole = role ? normalizeAppRole(role) : undefined

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "缺少 userId" },
        { status: 400 },
      )
    }

    if (nextRole && session.user?.id === userId && nextRole !== "boss") {
      return NextResponse.json(
        { success: false, message: "不能移除自己的老板权限" },
        { status: 400 },
      )
    }

    const updates: Record<string, unknown> = {}
    if (status) {
      if (!["active", "inactive", "banned"].includes(status)) {
        return NextResponse.json(
          { success: false, message: "无效的状态值" },
          { status: 400 },
        )
      }
      updates.status = status
    }

    if (nextRole) {
      if (!APP_ROLE_VALUES.includes(nextRole)) {
        return NextResponse.json(
          { success: false, message: "无效的角色值" },
          { status: 400 },
        )
      }
      updates.role = nextRole
    }

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { success: false, message: "无效的姓名" },
          { status: 400 },
        )
      }
      updates.name = name.trim()
    }

    if (password !== undefined) {
      if (typeof password !== "string" || password.trim().length < 6) {
        return NextResponse.json(
          { success: false, message: "密码至少 6 位" },
          { status: 400 },
        )
      }
      updates.password = await bcrypt.hash(password.trim(), 10)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, message: "没有需要更新的字段" },
        { status: 400 },
      )
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        role: normalizeAppRole(user.role),
      },
    })
  } catch (error) {
    console.error("更新用户失败:", error)
    return NextResponse.json(
      { success: false, message: "更新用户失败" },
      { status: 500 },
    )
  }
}
