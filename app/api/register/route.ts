import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { createUser, findUserByEmail } from "@/lib/users"

export async function POST(req: NextRequest) {
  const { username, email, password, name } = await req.json()
  const registerEmail = typeof email === "string" && email ? email : username

  if (!registerEmail || !password) {
    return NextResponse.json(
      { success: false, message: "用户名和密码都是必填项" },
      { status: 400 }
    )
  }

  const existingUser = await findUserByEmail(registerEmail)
  if (existingUser) {
    return NextResponse.json(
      { success: false, message: "用户名已存在" },
      { status: 400 }
    )
  }

  const user = await createUser(registerEmail, password, name)

  return NextResponse.json(
    {
      success: true,
      message: "注册成功",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    },
    { status: 201 }
  )
}
