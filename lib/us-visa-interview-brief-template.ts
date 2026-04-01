import fs from "fs/promises"
import path from "path"

const DEFAULT_TEMPLATE_PATH = path.join(
  process.cwd(),
  "storage",
  "templates",
  "us-visa",
  "interview-brief-template.docx",
)

export async function resolveUsVisaInterviewBriefTemplatePath(customTemplatePath?: string | null) {
  const candidates = [customTemplatePath, process.env.US_VISA_INTERVIEW_BRIEF_TEMPLATE_PATH, DEFAULT_TEMPLATE_PATH].filter(
    Boolean,
  ) as string[]

  for (const candidate of candidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      continue
    }
  }

  throw new Error(
    "Interview brief template is missing. Expected storage/templates/us-visa/interview-brief-template.docx or US_VISA_INTERVIEW_BRIEF_TEMPLATE_PATH.",
  )
}

export function getUsVisaInterviewBriefDefaultTemplatePath() {
  return DEFAULT_TEMPLATE_PATH
}
