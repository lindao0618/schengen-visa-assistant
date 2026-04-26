export type ApplicantIntakeLoadState = {
  open: boolean
  hasIntakeLoaded: boolean
  loading: boolean
}

export function shouldFetchApplicantIntake({
  open,
  hasIntakeLoaded,
  loading,
}: ApplicantIntakeLoadState) {
  return open && !hasIntakeLoaded && !loading
}
