/**
 * 启动 trip_generator 服务（行程单生成）
 * 由 npm run dev 自动调用；也可单独运行 npm run dev:trip 排查启动问题
 */
const { spawn } = require("child_process");
const path = require("path");

const cwd = path.join(__dirname, "..", "app", "trip_generator");
const isWin = process.platform === "win32";
const pythonCmd = isWin ? "python" : "python3";

console.log("[trip_generator] 启动中...", { cwd, cmd: `${pythonCmd} main.py` });

const proc = spawn(pythonCmd, ["-u", "main.py"], {
  cwd,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PYTHONIOENCODING: "utf-8" },
});

proc.on("error", (err) => {
  console.error("[trip_generator] 启动失败:", err.message);
  console.error("[trip_generator] 请确认已安装 Python 且已执行: pip install -r app/trip_generator/requirements.txt");
});

proc.on("exit", (code, signal) => {
  if (code !== null && code !== 0) {
    console.error(`[trip_generator] 进程退出 code=${code} signal=${signal}`);
    console.error("[trip_generator] 请在本目录单独运行: npm run dev:trip 查看上方完整报错（如缺依赖、端口 8002 被占用等）");
  }
});
