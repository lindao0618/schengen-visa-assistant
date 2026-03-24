import type { Dirent } from "fs"
import fs from "fs/promises"
import path from "path"

type CleanupRule = {
  dir: string
  maxAgeMs: number
  matcher?: RegExp
}

const TEMP_ROOT = path.join(process.cwd(), "temp")
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const SWEEP_INTERVAL_MS = 15 * 60 * 1000

const RULES: CleanupRule[] = [
  { dir: path.join(TEMP_ROOT, "photo-check-outputs"), maxAgeMs: DAY },
  { dir: path.join(TEMP_ROOT, "ais-register-outputs"), maxAgeMs: DAY },
  { dir: path.join(TEMP_ROOT, "ds160-submit-outputs"), maxAgeMs: 2 * DAY },
  { dir: path.join(TEMP_ROOT, "material-tasks-output"), maxAgeMs: 2 * DAY },
  { dir: path.join(TEMP_ROOT, "french-visa-extract"), maxAgeMs: 2 * DAY },
  { dir: path.join(TEMP_ROOT, "french-visa-register"), maxAgeMs: 2 * DAY },
  { dir: path.join(TEMP_ROOT, "french-visa-create-application"), maxAgeMs: 2 * DAY },
  { dir: path.join(TEMP_ROOT, "french-visa-fill-receipt"), maxAgeMs: 2 * DAY },
  { dir: path.join(TEMP_ROOT, "french-visa-submit-final"), maxAgeMs: 2 * DAY },
  // DS-160 自动填表会直接在 temp 根目录下创建临时工作目录
  { dir: TEMP_ROOT, maxAgeMs: 12 * HOUR, matcher: /^ds160-\d+/ },
]

let lastSweepAt = 0
let activeSweep: Promise<void> | null = null

async function safeRemove(target: string) {
  try {
    await fs.rm(target, { recursive: true, force: true })
  } catch (error) {
    console.warn("[temp-cleanup] remove failed:", target, error)
  }
}

async function cleanupRule(rule: CleanupRule, now: number) {
  let entries: Dirent[]
  try {
    entries = await fs.readdir(rule.dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (rule.matcher && !rule.matcher.test(entry.name)) continue

    const fullPath = path.join(rule.dir, entry.name)
    try {
      const stat = await fs.stat(fullPath)
      const updatedAt = Math.max(stat.mtimeMs, stat.ctimeMs)
      if (now - updatedAt < rule.maxAgeMs) continue
      await safeRemove(fullPath)
    } catch (error) {
      console.warn("[temp-cleanup] stat failed:", fullPath, error)
    }
  }
}

async function runSweep() {
  const now = Date.now()
  await Promise.all(RULES.map((rule) => cleanupRule(rule, now)))
  lastSweepAt = now
}

export async function ensureTempCleanup() {
  const now = Date.now()
  if (activeSweep) {
    await activeSweep
    return
  }
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) {
    return
  }

  activeSweep = runSweep().finally(() => {
    activeSweep = null
  })

  await activeSweep
}
