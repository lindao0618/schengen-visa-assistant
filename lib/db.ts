import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // 在开发环境中，防止因 Next.js 热重载导致创建多个 PrismaClient 实例
  // @ts-ignore
  if (!global.prisma) {
  // @ts-ignore
    global.prisma = new PrismaClient();
  }
  // @ts-ignore
  prisma = global.prisma;
}

export default prisma;
