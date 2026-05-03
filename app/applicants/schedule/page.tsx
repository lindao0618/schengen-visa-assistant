import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import ApplicantsScheduleClientPage from "@/app/applicants/schedule/ApplicantsScheduleClientPage"
import { authOptions } from "@/lib/auth"
import { getPublicUiPreviewSession } from "@/lib/public-ui-preview"

export default async function ApplicantsSchedulePage() {
  const session = await getServerSession(authOptions) || getPublicUiPreviewSession()

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/applicants/schedule")
  }

  return <ApplicantsScheduleClientPage />
}
