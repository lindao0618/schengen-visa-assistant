import fs from "fs"
import path from "path"

function findBundledPythonRuntime() {
  const cwd = process.cwd()
  const candidates =
    process.platform === "win32"
      ? [
          path.join(cwd, ".venv-server", "Scripts", "python.exe"),
          path.join(cwd, ".venv", "Scripts", "python.exe"),
        ]
      : [
          path.join(cwd, ".venv-server", "bin", "python"),
          path.join(cwd, ".venv", "bin", "python"),
        ]

  return candidates.find((candidate) => fs.existsSync(candidate))
}

export function getPythonRuntimeCommand() {
  const configured = process.env.PYTHON_BIN?.trim()
  if (configured) return configured

  const bundled = findBundledPythonRuntime()
  if (bundled) return bundled

  return process.platform === "win32" ? "python" : "python3"
}
