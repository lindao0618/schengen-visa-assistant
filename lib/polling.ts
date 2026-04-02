export const QUICK_WORKFLOW_POLL_INTERVAL_MS = 3000

export function getAdaptivePollInterval(baseInterval: number, hasActiveWork: boolean) {
  if (hasActiveWork) return Math.max(baseInterval, 2000)
  return Math.max(baseInterval * 4, 8000)
}
