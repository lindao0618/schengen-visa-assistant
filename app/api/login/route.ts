import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { verifyUserPassword } from "@/lib/users"

export async function POST(req: NextRequest) {
  const { username, email, password } = await req.json()
  const loginEmail = typeof email === "string" && email ? email : username

  if (!loginEmail || !password) {
    return NextResponse.json(
      { success: false, message: "用户名和密码都是必填项" },
      { status: 400 }
    )
  }

  const user = await verifyUserPassword(loginEmail, password)
  if (!user) {
    return NextResponse.json(
      { success: false, message: "用户名或密码错误" },
      { status: 401 }
    )
  }

  return NextResponse.json(
    {
      success: true,
      message: "登录成功",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    },
    { status: 200 }
  )
}
