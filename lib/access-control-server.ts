import { Prisma } from "@prisma/client"

import prisma from "@/lib/db"
import {
  AppRole,
  canBeCaseAssignee,
  canReadAllApplicants,
  getStoredRoleAliases,
  normalizeAppRole,
} from "@/lib/access-control"

export async function resolveViewerRole(userId: string, role?: string | null): Promise<AppRole> {
  if (role) return normalizeAppRole(role)

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  return normalizeAppRole(user?.role)
}

export function buildApplicantAccessWhere(userId: string, role: AppRole): Prisma.ApplicantProfileWhereInput {
  if (canReadAllApplicants(role)) return {}

  return {
    OR: [
      { userId },
      {
        visaCases: {
          some: {
            assignedToUserId: userId,
          },
        },
      },
    ],
  }
}

export function buildCaseAccessWhere(userId: string, role: AppRole): Prisma.VisaCaseWhereInput {
  if (canReadAllApplicants(role)) return {}

  return {
    OR: [
      { userId },
      { assignedToUserId: userId },
      { applicantProfile: { userId } },
    ],
  }
}

export function buildAssignableUserWhere(): Prisma.UserWhereInput {
  return {
    status: "active",
    role: {
      in: Array.from(
        new Set(
          ["boss", "supervisor", "specialist", "admin", "user"].filter((value) =>
            canBeCaseAssignee(value),
          ),
        ),
      ),
    },
  }
}

export function buildStoredRoleWhere(role?: string | null): Prisma.UserWhereInput | undefined {
  if (!role || role === "all") return undefined

  return {
    role: {
      in: getStoredRoleAliases(role),
    },
  }
}
