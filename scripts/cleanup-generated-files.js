const fs = require("fs/promises")
const path = require("path")
const { spawnSync } = require("child_process")

const rootDir = process.cwd()
const args = new Set(process.argv.slice(2))
const isDryRun = args.has("--dry-run")
const includeRuntime = args.has("--include-runtime")

const safeDirectoryTargets = [
  ".next",
  "temp",
  "logs",
  "output",
  "uploads",
  "public/uploads",
  "app/trip_generator/output",
]

const runtimeDirectoryTargets = [
  "services/usvisa-runtime/uploads",
  "services/usvisa-runtime/__pycache__",
  "services/usvisa-runtime/venv",
  "services/usvisa-runtime/ds160-server-package/excel_files",
  "services/usvisa-runtime/ds160-server-package/photos",
  "services/usvisa-runtime/ds160-server-package/logs",
  "services/usvisa-runtime/ds160-server-package/output",
  "services/usvisa-runtime/ds160-server-package/venv",
  "services/usvisa-runtime/ds160-server-package/__pycache__",
  "services/ds160-processor/venv",
  "services/ds160-processor/excel_files",
  "services/ds160-processor/photos",
  "services/ds160-processor/logs",
  "services/ds160-processor/output",
]

const runtimeFileTargets = [
  "services/usvisa-runtime/ds160-server-package.rar",
  "services/usvisa-runtime/log.txt",
  "services/usvisa-runtime/result.json",
]

const runtimePatternTargets = [
  {
    directory: "services/usvisa-runtime/ds160-server-package",
    patterns: [
      /^error_\d+\.(png|jpg|jpeg|html)$/i,
      /^error_html_\d+\.html$/i,
      /^initial_html_\d+\.html$/i,
      /^initial_page_\d+\.png$/i,
      /^captcha_\d+\.png$/i,
      /^full_page_for_captcha_\d+\.png$/i,
      /^page_html_for_captcha_\d+\.html$/i,
      /^ds160_timing_\d{8}_\d{6}\.txt$/i,
      /^employer_debug_\d+\.html$/i,
      /^AA[0-9A-Z]+\.png$/i,
      /^~\$.*$/i,
      /^ds160(?:_api)?\.log$/i,
    ],
  },
]

async function pathExists(relativePath) {
  try {
    await fs.access(path.join(rootDir, relativePath))
    return true
  } catch {
    return false
  }
}

function normalizeRelativePath(relativePath) {
  return relativePath.replace(/\\/g, "/")
}

function getTrackedFileSet(targets) {
  if (targets.length === 0) {
    return new Set()
  }

  const result = spawnSync("git", ["ls-files", "-z", "--", ...targets], {
    cwd: rootDir,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })

  if (result.error || result.status !== 0) {
    return new Set()
  }

  const trackedFiles = result.stdout
    .split("\0")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(normalizeRelativePath)

  return new Set(trackedFiles)
}

async function getPathStats(relativePath) {
  const absolutePath = path.join(rootDir, relativePath)
  try {
    return await fs.lstat(absolutePath)
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null
    }
    throw error
  }
}

async function collectDirectoryEntries(relativeDir) {
  const absoluteDir = path.join(rootDir, relativeDir)
  let entries = []
  try {
    entries = await fs.readdir(absoluteDir, { withFileTypes: true })
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return []
    }
    throw error
  }
  return entries.map((entry) => ({
    name: entry.name,
    relativePath: normalizeRelativePath(path.join(relativeDir, entry.name)),
    isDirectory: entry.isDirectory(),
  }))
}

async function getDirectorySize(relativeDir) {
  const absoluteDir = path.join(rootDir, relativeDir)
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true })
  let total = 0

  for (const entry of entries) {
    const relativePath = normalizeRelativePath(path.join(relativeDir, entry.name))
    const absolutePath = path.join(absoluteDir, entry.name)

    if (entry.isDirectory()) {
      total += await getDirectorySize(relativePath)
      continue
    }

    const stats = await fs.lstat(absolutePath)
    total += stats.size
  }

  return total
}

function formatSize(sizeInBytes) {
  if (sizeInBytes <= 0) {
    return "0 MB"
  }

  return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`
}

async function removeFile(relativePath, stats, trackedFiles, removedItems) {
  const normalized = normalizeRelativePath(relativePath)
  if (trackedFiles.has(normalized)) {
    return
  }

  if (!isDryRun) {
    await fs.rm(path.join(rootDir, normalized), { force: true })
  }

  removedItems.push({
    path: normalized,
    size: stats.size,
  })
}

async function removeDirectoryContents(relativeDir, trackedFiles, removedItems) {
  if (!(await pathExists(relativeDir))) {
    return
  }

  const entries = await collectDirectoryEntries(relativeDir)
  for (const entry of entries) {
    if (entry.isDirectory) {
      await removeDirectoryContents(entry.relativePath, trackedFiles, removedItems)

      if (!trackedFiles.has(entry.relativePath)) {
        const absolutePath = path.join(rootDir, entry.relativePath)
        const remainingEntries = await fs.readdir(absolutePath).catch(() => [])
        if (remainingEntries.length === 0 && !isDryRun) {
          await fs.rm(absolutePath, { recursive: true, force: true })
        }
      }

      continue
    }

    const stats = await getPathStats(entry.relativePath)
    if (!stats) {
      continue
    }
    await removeFile(entry.relativePath, stats, trackedFiles, removedItems)
  }
}

async function removePatternMatches(target, trackedFiles, removedItems) {
  if (!(await pathExists(target.directory))) {
    return
  }

  const entries = await collectDirectoryEntries(target.directory)
  for (const entry of entries) {
    if (entry.isDirectory) {
      continue
    }

    if (!target.patterns.some((pattern) => pattern.test(entry.name))) {
      continue
    }

    const stats = await getPathStats(entry.relativePath)
    await removeFile(entry.relativePath, stats, trackedFiles, removedItems)
  }
}

async function cleanDirectoryTargets(targets, trackedFiles, removedItems) {
  for (const target of targets) {
    if (!(await pathExists(target))) {
      continue
    }

    await removeDirectoryContents(target, trackedFiles, removedItems)

    const absoluteTarget = path.join(rootDir, target)
    const remainingEntries = await fs.readdir(absoluteTarget).catch(() => [])
    if (remainingEntries.length === 0 && !isDryRun) {
      await fs.rm(absoluteTarget, { recursive: true, force: true })
    }
  }
}

async function cleanFileTargets(targets, trackedFiles, removedItems) {
  for (const target of targets) {
    if (!(await pathExists(target))) {
      continue
    }

    const stats = await getPathStats(target)
    if (stats.isDirectory()) {
      continue
    }

    await removeFile(target, stats, trackedFiles, removedItems)
  }
}

async function main() {
  const trackedTargets = [
    ...safeDirectoryTargets,
    ...(includeRuntime ? runtimeDirectoryTargets : []),
    ...(includeRuntime ? runtimeFileTargets : []),
    ...(includeRuntime ? runtimePatternTargets.map((item) => item.directory) : []),
  ]

  const trackedFiles = getTrackedFileSet(trackedTargets)
  const removedItems = []

  await cleanDirectoryTargets(safeDirectoryTargets, trackedFiles, removedItems)

  if (includeRuntime) {
    await cleanDirectoryTargets(runtimeDirectoryTargets, trackedFiles, removedItems)
    await cleanFileTargets(runtimeFileTargets, trackedFiles, removedItems)

    for (const target of runtimePatternTargets) {
      await removePatternMatches(target, trackedFiles, removedItems)
    }
  }

  const removedCount = removedItems.length
  const removedSize = removedItems.reduce((sum, item) => sum + item.size, 0)

  console.log(
    `${isDryRun ? "Would remove" : "Removed"} ${removedCount} item(s), freeing ${formatSize(removedSize)}.`
  )

  if (removedCount > 0) {
    for (const item of removedItems.slice(0, 20)) {
      console.log(`- ${item.path} (${formatSize(item.size)})`)
    }

    if (removedItems.length > 20) {
      console.log(`...and ${removedItems.length - 20} more item(s).`)
    }
  }

  if (includeRuntime) {
    console.log("Runtime cleanup was enabled. Recreate deleted Python environments or uploads only if needed.")
  } else {
    console.log("Runtime cleanup was skipped. Re-run with --include-runtime if you want to remove Python envs and DS-160 uploads.")
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
