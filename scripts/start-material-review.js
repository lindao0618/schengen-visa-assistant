/**
 * 启动 material_review 材料审核服务（腾讯云 OCR + DeepSeek）
 * 由 npm run dev 自动调用，使用端口 8004
 */
const { spawn } = require("child_process");
const path = require("path");

const cwd = path.join(__dirname, "..", "app", "material_review");
const isWin = process.platform === "win32";
const pythonCmd = isWin ? "python" : "python3";

const proc = spawn(pythonCmd, ["tencent_ocr_main.py"], {
  cwd,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PYTHONIOENCODING: "utf-8", MATERIAL_REVIEW_PORT: "8004" },
});

proc.on("error", (err) => {
  console.error("[material-review] 启动失败:", err.message);
});

proc.on("exit", (code, signal) => {
  if (code !== null && code !== 0) {
    console.error(`[material-review] 进程退出，code=${code}`);
  }
});
