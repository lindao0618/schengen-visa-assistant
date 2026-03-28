import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { authOptions } from "@/lib/auth"
import ApplicantsCrmClientPage from "@/app/applicants/ApplicantsCrmClientPage"

export default async function ApplicantsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/applicants")
  }

  return <ApplicantsCrmClientPage />
}
