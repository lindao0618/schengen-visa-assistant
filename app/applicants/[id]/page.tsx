import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import ApplicantDetailClientEntry from "@/app/applicants/[id]/ApplicantDetailClientEntry"
import { authOptions } from "@/lib/auth"

export default async function ApplicantDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    const nextSearchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(searchParams ?? {})) {
      if (typeof value === "string" && value) {
        nextSearchParams.set(key, value)
        continue
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item) nextSearchParams.append(key, item)
        }
      }
    }

    const callbackUrl = nextSearchParams.size > 0
      ? `/applicants/${params.id}?${nextSearchParams.toString()}`
      : `/applicants/${params.id}`
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  return <ApplicantDetailClientEntry applicantId={params.id} viewerRole={session.user.role} />
}
