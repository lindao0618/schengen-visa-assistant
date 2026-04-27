export type ApplicantCrmCaseListFlags = {
  includeStats?: boolean
  includeSelectorCases?: boolean
}

export function getApplicantCrmCaseListTakeLimit(flags: ApplicantCrmCaseListFlags) {
  return flags.includeStats || flags.includeSelectorCases ? undefined : 1
}
