const fs = require("fs/promises")
const path = require("path")
const { spawnSync } = require("child_process")

const rootDir = process.cwd()

async function pathExists(relativePath) {
  try {
    await fs.access(path.join(rootDir, relativePath))
    return true
  } catch {
    return false
  }
}

async function getDirectorySize(absoluteDir) {
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true })
  let total = 0

  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry.name)
    if (entry.isDirectory()) {
      total += await getDirectorySize(absolutePath)
      continue
    }

    const stats = await fs.lstat(absolutePath)
    total += stats.size
  }

  return total
}

function formatSize(sizeInBytes) {
  if (sizeInBytes > 1024 * 1024 * 1024) {
    return `${(sizeInBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`
}

async function buildDirectoryReport(relativePaths) {
  const rows = []

  for (const relativePath of relativePaths) {
    if (!(await pathExists(relativePath))) {
      continue
    }

    const absolutePath = path.join(rootDir, relativePath)
    const stats = await fs.lstat(absolutePath)
    if (!stats.isDirectory()) {
      rows.push({
        path: relativePath,
        size: stats.size,
      })
      continue
    }

    rows.push({
      path: relativePath,
      size: await getDirectorySize(absolutePath),
    })
  }

  return rows.sort((left, right) => right.size - left.size)
}

function printTable(title, rows, limit = rows.length) {
  if (rows.length === 0) {
    return
  }

  console.log(`\n${title}`)
  console.log("-".repeat(title.length))

  for (const row of rows.slice(0, limit)) {
    console.log(`${row.path.padEnd(40)} ${formatSize(row.size)}`)
  }
}

async function main() {
  const rootEntries = await fs.readdir(rootDir, { withFileTypes: true })
  const rootDirectories = rootEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

  const hotspotPaths = [
    ".git",
    ".next",
    "temp",
    "uploads",
    "output",
    "logs",
    "app/trip_generator/output",
    "services",
    "services/usvisa-runtime",
    "services/usvisa-runtime/ds160-server-package",
    "services/usvisa-runtime/venv",
    "services/ds160-processor",
    "services/ds160-processor/venv",
    "services/ds160-processor/excel_files",
    "services/ds160-processor/photos",
  ]

  const rootRows = await buildDirectoryReport(rootDirectories)
  const hotspotRows = await buildDirectoryReport(hotspotPaths)

  printTable("Top-level directories", rootRows, 15)
  printTable("Known hotspots", hotspotRows)

  const gitStats = spawnSync("git", ["count-objects", "-vH"], {
    cwd: rootDir,
    encoding: "utf8",
  })

  if (gitStats.status === 0 && gitStats.stdout.trim()) {
    console.log("\nGit object database")
    console.log("-------------------")
    console.log(gitStats.stdout.trim())
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
