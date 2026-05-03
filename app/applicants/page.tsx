import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { authOptions } from "@/lib/auth"
import { getPublicUiPreviewSession } from "@/lib/public-ui-preview"
import { ApplicantsPageShell } from "@/app/applicants/ApplicantsPageShell"

export default async function ApplicantsPage() {
  const session = await getServerSession(authOptions) || getPublicUiPreviewSession()

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/applicants")
  }

  return <ApplicantsPageShell />
}
