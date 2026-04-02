type WecomApiSuccess<T> = T & {
  errcode: 0
  errmsg: "ok"
}

type WecomAccessTokenResponse = {
  errcode?: number
  errmsg?: string
  access_token?: string
  expires_in?: number
}

type RawWecomDriveFile = {
  fileid?: string
  file_name?: string
  spaceid?: string
  fatherid?: string
  file_size?: string | number
  ctime?: string | number
  mtime?: string | number
  file_type?: string | number
  file_status?: string | number
  sha?: string
  md5?: string
  url?: string
}

type WecomDriveListResponse = {
  errcode?: number
  errmsg?: string
  has_more?: boolean
  next_start?: number | string
  file_list?: {
    item?: RawWecomDriveFile[]
  }
}

type WecomDriveFileInfoResponse = {
  errcode?: number
  errmsg?: string
  file_info?: RawWecomDriveFile
}

type WecomDriveDownloadResponse = {
  errcode?: number
  errmsg?: string
  download_url?: string
  cookie_name?: string
  cookie_value?: string
}

export type WecomDriveRoot = {
  id: string
  label: string
  spaceId: string
  fatherId: string
}

export type WecomDriveStatus = {
  configured: boolean
  missing: string[]
  roots: WecomDriveRoot[]
}

export type WecomDriveItem = {
  fileId: string
  fileName: string
  spaceId: string
  fatherId: string
  fileSize: string
  createdAt: string
  updatedAt: string
  fileType: string
  fileStatus: string
  sha?: string
  md5?: string
  url?: string
  isFolder: boolean
}

type WecomDriveTokenCache = {
  token: string
  expiresAt: number
}

const tokenCache = globalThis as typeof globalThis & {
  __wecomDriveTokenCache?: WecomDriveTokenCache
}

function readEnv(name: string) {
  return process.env[name]?.trim() || ""
}

function normalizeRoot(input: unknown, index: number): WecomDriveRoot | null {
  if (!input || typeof input !== "object") return null

  const record = input as Record<string, unknown>
  const id = String(record.id || `root-${index + 1}`).trim()
  const label = String(record.label || "").trim()
  const spaceId = String(record.spaceId || record.spaceid || "").trim()
  const fatherId = String(record.fatherId || record.fatherid || "").trim()

  if (!label || !spaceId || !fatherId) return null

  return {
    id,
    label,
    spaceId,
    fatherId,
  }
}

export function getWecomDriveRoots() {
  const raw = readEnv("WECOM_DRIVE_ROOTS_JSON")
  if (!raw) return [] as WecomDriveRoot[]

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [] as WecomDriveRoot[]
    return parsed.map(normalizeRoot).filter((item): item is WecomDriveRoot => Boolean(item))
  } catch {
    return [] as WecomDriveRoot[]
  }
}

export function getWecomDriveStatus(): WecomDriveStatus {
  const missing: string[] = []
  if (!readEnv("WECOM_CORP_ID")) missing.push("WECOM_CORP_ID")
  if (!readEnv("WECOM_AGENT_SECRET")) missing.push("WECOM_AGENT_SECRET")

  const roots = getWecomDriveRoots()
  if (roots.length === 0) missing.push("WECOM_DRIVE_ROOTS_JSON")

  return {
    configured: missing.length === 0,
    missing,
    roots,
  }
}

export function getWecomDriveRootById(rootId: string) {
  return getWecomDriveRoots().find((item) => item.id === rootId) || null
}

function requireConfigured() {
  const status = getWecomDriveStatus()
  if (!status.configured) {
    throw new Error(`Missing WeCom drive config: ${status.missing.join(", ")}`)
  }
  return status
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (!text) {
    throw new Error("Empty response from WeCom API")
  }
  return JSON.parse(text) as T
}

function assertWecomSuccess<T extends { errcode?: number; errmsg?: string }>(payload: T): asserts payload is T & { errcode: 0; errmsg: string } {
  if ((payload.errcode ?? 0) !== 0) {
    throw new Error(`WeCom API error ${payload.errcode}: ${payload.errmsg || "unknown error"}`)
  }
}

async function getWecomAccessToken() {
  const now = Date.now()
  if (tokenCache.__wecomDriveTokenCache && tokenCache.__wecomDriveTokenCache.expiresAt > now + 60_000) {
    return tokenCache.__wecomDriveTokenCache.token
  }

  requireConfigured()
  const corpId = readEnv("WECOM_CORP_ID")
  const agentSecret = readEnv("WECOM_AGENT_SECRET")
  const url = new URL("https://qyapi.weixin.qq.com/cgi-bin/gettoken")
  url.searchParams.set("corpid", corpId)
  url.searchParams.set("corpsecret", agentSecret)

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch WeCom access token: ${response.status}`)
  }

  const payload = await parseJsonResponse<WecomAccessTokenResponse>(response)
  assertWecomSuccess(payload)
  if (!payload.access_token || !payload.expires_in) {
    throw new Error("WeCom access token response missing access_token or expires_in")
  }

  tokenCache.__wecomDriveTokenCache = {
    token: payload.access_token,
    expiresAt: now + payload.expires_in * 1000,
  }

  return payload.access_token
}

async function postWecomDrive<TResponse extends { errcode?: number; errmsg?: string }>(path: string, body: object) {
  const accessToken = await getWecomAccessToken()
  const response = await fetch(`https://qyapi.weixin.qq.com/cgi-bin/${path}?access_token=${encodeURIComponent(accessToken)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`WeCom API request failed: ${response.status}`)
  }

  const payload = await parseJsonResponse<TResponse>(response)
  assertWecomSuccess(payload)
  return payload
}

function toIsoLike(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") return ""
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value)

  const millis = numeric > 1_000_000_000_000 ? numeric : numeric * 1000
  const date = new Date(millis)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toISOString()
}

function toStringValue(value: string | number | undefined) {
  if (value === undefined || value === null) return ""
  return String(value)
}

export function looksLikeWecomFolder(input: { fileName?: string; fileType?: string; fileSize?: string; url?: string }) {
  const fileType = (input.fileType || "").toLowerCase()
  if (fileType.includes("folder") || fileType.includes("dir")) return true

  const fileName = input.fileName || ""
  const hasExtension = /\.[a-z0-9]{1,10}$/i.test(fileName)
  const size = Number(input.fileSize || "0")

  if (!hasExtension && size === 0) return true
  if (!hasExtension && !input.url) return true

  return false
}

function normalizeDriveItem(item: RawWecomDriveFile): WecomDriveItem | null {
  const fileId = toStringValue(item.fileid)
  const fileName = toStringValue(item.file_name)
  const spaceId = toStringValue(item.spaceid)
  const fatherId = toStringValue(item.fatherid)

  if (!fileId || !fileName || !spaceId) return null

  const fileType = toStringValue(item.file_type)
  const fileSize = toStringValue(item.file_size)
  const url = toStringValue(item.url) || undefined

  return {
    fileId,
    fileName,
    spaceId,
    fatherId,
    fileSize,
    createdAt: toIsoLike(item.ctime),
    updatedAt: toIsoLike(item.mtime),
    fileType,
    fileStatus: toStringValue(item.file_status),
    sha: toStringValue(item.sha) || undefined,
    md5: toStringValue(item.md5) || undefined,
    url,
    isFolder: looksLikeWecomFolder({
      fileName,
      fileType,
      fileSize,
      url,
    }),
  }
}

export async function listWecomDriveFiles(params: {
  spaceId: string
  fatherId: string
  start?: number
  limit?: number
  sortType?: number
}) {
  requireConfigured()
  const payload = await postWecomDrive<WecomDriveListResponse>("wedrive/file_list", {
    spaceid: params.spaceId,
    fatherid: params.fatherId,
    sort_type: params.sortType ?? 1,
    start: params.start ?? 0,
    limit: params.limit ?? 100,
  })

  const items = (payload.file_list?.item || [])
    .map((item) => normalizeDriveItem(item))
    .filter((item): item is WecomDriveItem => Boolean(item))

  return {
    items,
    hasMore: Boolean(payload.has_more),
    nextStart: payload.next_start !== undefined && payload.next_start !== null ? Number(payload.next_start) : null,
  }
}

export async function getWecomDriveFileInfo(fileId: string) {
  requireConfigured()
  const payload = await postWecomDrive<WecomDriveFileInfoResponse>("wedrive/file_info", {
    fileid: fileId,
  })

  const item = normalizeDriveItem(payload.file_info || {})
  if (!item) {
    throw new Error("WeCom file info response missing file details")
  }
  return item
}

export async function getWecomDriveDownloadInfo(fileId: string) {
  requireConfigured()
  const payload = await postWecomDrive<WecomDriveDownloadResponse>("wedrive/file_download", {
    fileid: fileId,
  })

  return {
    downloadUrl: payload.download_url || "",
    cookieName: payload.cookie_name || "",
    cookieValue: payload.cookie_value || "",
  }
}
