import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

type CaptchaBalanceResponse = {
  capsolver: { configured: boolean; balance: number | null; error: string | null }
  twocaptcha: { configured: boolean; balance: number | null; error: string | null }
}

const CAPTCHA_BALANCE_CACHE_TTL_MS = 30_000

let cachedBalance: { data: CaptchaBalanceResponse; expiresAt: number } | null = null
let inFlightBalanceRequest: Promise<CaptchaBalanceResponse> | null = null

async function getCapsolverBalance(apiKey: string): Promise<{ balance: number | null; error?: string }> {
  try {
    const res = await fetch("https://api.capsolver.com/getBalance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientKey: apiKey }),
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json()
    if (data.errorId === 0) return { balance: data.balance }
    return { balance: null, error: data.errorDescription || `errorId=${data.errorId}` }
  } catch (e) {
    return { balance: null, error: e instanceof Error ? e.message : "请求失败" }
  }
}

async function get2captchaBalance(apiKey: string): Promise<{ balance: number | null; error?: string }> {
  try {
    const url = `https://2captcha.com/res.php?key=${encodeURIComponent(apiKey)}&action=getbalance&json=1`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const data = await res.json()
    if (data.status === 1) return { balance: parseFloat(data.request) }
    return { balance: null, error: data.request || "查询失败" }
  } catch (e) {
    return { balance: null, error: e instanceof Error ? e.message : "请求失败" }
  }
}

export async function GET() {
  if (cachedBalance && cachedBalance.expiresAt > Date.now()) {
    return NextResponse.json(cachedBalance.data)
  }

  if (inFlightBalanceRequest) {
    return NextResponse.json(await inFlightBalanceRequest)
  }

  inFlightBalanceRequest = (async () => {
  const capsolverKey = process.env.CAPSOLVER_API_KEY || process.env.CAPSOLVER_KEY || ""
  const twocaptchaKey =
    process.env.TWOCAPTCHA_API_KEY ||
    process.env["2CAPTCHA_API_KEY"] ||
    process.env["2CAPTCHA_KEY"] ||
    process.env.CAPTCHA_API_KEY ||
    ""

  const result: CaptchaBalanceResponse = {
    capsolver: { configured: false, balance: null, error: null },
    twocaptcha: { configured: false, balance: null, error: null },
  }

  if (capsolverKey) {
    const r = await getCapsolverBalance(capsolverKey)
    result.capsolver = { configured: true, balance: r.balance, error: r.error ?? null }
  }

  if (twocaptchaKey) {
    const r = await get2captchaBalance(twocaptchaKey)
    result.twocaptcha = { configured: true, balance: r.balance, error: r.error ?? null }
  }

    cachedBalance = {
      data: result,
      expiresAt: Date.now() + CAPTCHA_BALANCE_CACHE_TTL_MS,
    }
    return result
  })()

  try {
    const result = await inFlightBalanceRequest
    return NextResponse.json(result)
  } finally {
    inFlightBalanceRequest = null
  }
}
