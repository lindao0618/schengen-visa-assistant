import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { verifyUserPassword } from "./users"

const nextAuthSecret = process.env.NEXTAUTH_SECRET

if (!nextAuthSecret) {
  throw new Error("NEXTAUTH_SECRET is required. Please set it in your environment file using UTF-8 encoding.")
}

// 扩展NextAuth类型
declare module "next-auth" {
  interface User {
    role?: string
  }
  interface Session {
    user: {
      id?: string
      role?: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string
    id?: string
    name?: string
    email?: string
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          // 验证用户
          const user = await verifyUserPassword(credentials.email, credentials.password);
          
          if (!user) {
            console.log("用户认证失败:", credentials.email);
            return null;
          }

          console.log("用户认证成功:", user.email, "角色:", user.role);
          
          return {
            id: user.id,
            name: user.name || user.email.split('@')[0],
            email: user.email,
            role: user.role
          };
        } catch (error) {
          console.error("认证过程中出错:", error)
          return null
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.name = user.name ?? undefined
        token.email = user.email ?? undefined
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.name = (token.name ?? session.user?.name) ?? null
        session.user.email = (token.email ?? session.user?.email) ?? null
      }
      return session
    }
  },
  pages: {
    signIn: "/login", // 修改为普通用户登录页面
    // 管理员登录页面在代码中单独处理
  },
  secret: nextAuthSecret,
  debug: false
}
