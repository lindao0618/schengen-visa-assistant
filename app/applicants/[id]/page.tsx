import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import ApplicantDetailClientPage from "@/app/applicants/[id]/ApplicantDetailClientPage"
import { authOptions } from "@/lib/auth"

export default async function ApplicantDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/applicants/${params.id}`)
  }

  return <ApplicantDetailClientPage applicantId={params.id} />
}
