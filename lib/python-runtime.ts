export function getPythonRuntimeCommand() {
  const configured = process.env.PYTHON_BIN?.trim()
  if (configured) return configured
  return process.platform === "win32" ? "python" : "python3"
}
