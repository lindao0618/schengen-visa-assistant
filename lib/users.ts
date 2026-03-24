import bcrypt from "bcryptjs"
import prisma from "./db"

export interface User {
  id: string
  email: string
  password: string
  name?: string
  role: string
}

function toUser(row: {
  id: string
  email: string
  password: string
  name: string | null
  role: string
}): User {
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    name: row.name ?? undefined,
    role: row.role,
  }
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const dbUser = await prisma.user.findUnique({ where: { email } })
  return dbUser ? toUser(dbUser) : null
}

export async function createUser(
  email: string,
  password: string,
  name?: string
): Promise<User> {
  const existing = await findUserByEmail(email)
  if (existing) {
    throw new Error("该邮箱已被注册")
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const displayName = name || email.split("@")[0]

  const dbUser = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: displayName,
      role: "user",
      status: "active",
    },
  })

  return toUser(dbUser)
}

export async function verifyUserPassword(
  email: string,
  password: string
): Promise<User | null> {
  const dbUser = await prisma.user.findUnique({ where: { email } })
  if (!dbUser) return null

  const match = await bcrypt.compare(password, dbUser.password)
  return match ? toUser(dbUser) : null
}
