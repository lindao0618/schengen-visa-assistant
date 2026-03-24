const { spawnSync } = require("child_process")
const nextBin = require.resolve("next/dist/bin/next")

const result = spawnSync(process.execPath, [nextBin, "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_BUILD_SEPARATE: "1",
  },
})

if (result.error) {
  throw result.error
}

process.exit(result.status ?? 0)
