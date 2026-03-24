/**
 * 启动 explanation_letter_generator 服务（解释信生成，使用 DeepSeek AI）
 * 由 npm run dev 自动调用
 */
const { spawn } = require("child_process");
const path = require("path");

const cwd = path.join(__dirname, "..", "explanation_letter_generator");
const isWin = process.platform === "win32";
const pythonCmd = isWin ? "python" : "python3";

const proc = spawn(pythonCmd, ["main.py"], {
  cwd,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PYTHONIOENCODING: "utf-8" },
});

proc.on("error", (err) => {
  console.error("[explanation-letter] 启动失败:", err.message);
});

proc.on("exit", (code, signal) => {
  if (code !== null && code !== 0) {
    console.error(`[explanation-letter] 进程退出，code=${code}`);
  }
});
