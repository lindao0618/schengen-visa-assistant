const net = require("net")
const { spawn } = require("child_process")
const nextBin = require.resolve("next/dist/bin/next")

const DEV_PORT = Number(process.env.PORT || 3000)

function checkPortAvailable() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()

    server.once("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        reject(
          new Error(
            `Next dev port ${DEV_PORT} is already in use. Stop the process on that port before running npm run dev, otherwise the browser HMR client may keep reconnecting to the wrong dev server.`,
          ),
        )
        return
      }

      reject(error)
    })

    server.once("listening", () => {
      server.close(resolve)
    })

    server.listen(DEV_PORT)
  })
}

async function main() {
  if (!Number.isInteger(DEV_PORT) || DEV_PORT <= 0) {
    throw new Error(`Invalid dev port: ${process.env.PORT}`)
  }

  await checkPortAvailable()

  const child = spawn(process.execPath, [nextBin, "dev", "--port", String(DEV_PORT)], {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: String(DEV_PORT),
    },
  })

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      child.kill(signal)
    })
  }

  child.on("error", (error) => {
    throw error
  })

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 0)
  })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
