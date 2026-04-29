"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuthPrompt } from "../contexts/AuthPromptContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { UserPlus, Loader2, AlertCircle, Plus, Trash2, UserRound, FileSpreadsheet, Copy, Wand2, PlayCircle } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useActiveApplicantProfile } from "@/hooks/use-active-applicant-profile"

const MANUAL_OPTION = "__manual__"

interface ApplicantProfileOption {
  id: string
  label: string
  name?: string
  files?: Record<string, { originalName?: string }>
}

interface AisGroup {
  id: string
  applicantProfileId: string
  excelFile: File | null
}

type ExternalAisFormPayload = {
  passport_country?: string
  birth_country?: string
  residency_country?: string
  passport_number?: string
  ds160_number?: string
  visa_class?: string
  date_of_birth?: string
  phone?: string
  email?: string
  is_renewal?: boolean
  traveling_to_apply?: boolean
}

function createGroup(applicantProfileId = ""): AisGroup {
  return {
    id: `ais-group-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    applicantProfileId,
    excelFile: null,
  }
}

function getProfileExcel(profile: ApplicantProfileOption | undefined) {
  if (!profile?.files) return null
  return (
    profile.files.usVisaDs160Excel ||
    profile.files.ds160Excel ||
    profile.files.usVisaAisExcel ||
    profile.files.aisExcel ||
    null
  )
}

function sanitizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function pickFirst(...values: Array<unknown>) {
  for (const value of values) {
    const normalized = sanitizeText(value)
    if (normalized) return normalized
  }
  return ""
}

function normalizeBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value
  const normalized = sanitizeText(value).toLowerCase()
  if (!normalized) return undefined
  if (["yes", "y", "true", "1", "是"].includes(normalized)) return true
  if (["no", "n", "false", "0", "否"].includes(normalized)) return false
  return undefined
}

function toIsoDateString(value: unknown) {
  const raw = sanitizeText(value)
  if (!raw) return ""
  const normalized = raw.replace(/[.]/g, "/").replace(/年/g, "/").replace(/月/g, "/").replace(/日/g, "").trim()
  const parsed = new Date(normalized)
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear()
    const month = String(parsed.getMonth() + 1).padStart(2, "0")
    const day = String(parsed.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }
  const dmy = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) {
    const day = Number(dmy[1])
    const month = Number(dmy[2])
    const year = Number(dmy[3])
    if (year > 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    }
  }
  return ""
}

function buildExternalAisFormPayload(applicant: ReturnType<typeof useActiveApplicantProfile>): ExternalAisFormPayload {
  const intakeFields = ((applicant as {
    usVisa?: { fullIntake?: { fields?: Record<string, string> } }
  } | null)?.usVisa?.fullIntake?.fields || {}) as Record<string, string>

  const payload: ExternalAisFormPayload = {
    passport_country: pickFirst(
      intakeFields.passportIssueCountry,
      intakeFields.passportCountry,
      intakeFields.passportIssuedCountry,
      intakeFields.countryAuthorityThatIssuedPassport,
    ),
    birth_country: pickFirst(
      intakeFields.birthCountry,
      intakeFields.countryOfBirth,
    ),
    residency_country: pickFirst(
      intakeFields.countryOfPermanentResidence,
      intakeFields.residencyCountry,
      intakeFields.residenceCountry,
    ),
    passport_number: pickFirst(intakeFields.passportNumber, applicant?.passportNumber, applicant?.usVisa?.passportNumber),
    ds160_number: pickFirst(intakeFields.applicationId, applicant?.usVisa?.aaCode),
    visa_class: pickFirst(intakeFields.visaClass, intakeFields.visaType),
    date_of_birth: toIsoDateString(pickFirst(intakeFields.dateOfBirth, intakeFields.birthDate)),
    phone: pickFirst(intakeFields.primaryPhone, applicant?.phone).replace(/\D/g, ""),
    email: pickFirst(intakeFields.personalEmail, applicant?.email),
    is_renewal: normalizeBoolean(pickFirst(intakeFields.hasUsVisa, intakeFields.previousUsTravel)),
    traveling_to_apply: false,
  }

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== "" && value !== undefined),
  ) as ExternalAisFormPayload
}

function buildExternalAisScript(payload: ExternalAisFormPayload) {
  const payloadJson = JSON.stringify(payload, null, 2)
  return `(() => {
  const data = ${payloadJson};
  const $ = (s) => document.querySelector(s);
  const norm = (v) => (v == null ? "" : String(v)).trim().toLowerCase();

  const fire = (el) => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  };

  const setInput = (selector, value) => {
    const el = $(selector);
    if (!el || value == null || value === "") return false;
    el.value = String(value);
    fire(el);
    return true;
  };

  const clearInput = (selector) => {
    const el = $(selector);
    if (!el) return false;
    el.value = "";
    fire(el);
    return true;
  };

  const setCheckbox = (selector, checked) => {
    const el = $(selector);
    if (!el) return false;
    el.checked = !!checked;
    fire(el);
    return true;
  };

  const setRadioByBoolean = (name, boolVal) => {
    if (typeof boolVal !== "boolean") return false;
    const target = document.querySelector(\`input[type="radio"][name="\${name}"][value="\${boolVal ? "true" : "false"}"]\`);
    if (!target) return false;
    target.checked = true;
    fire(target);
    return true;
  };

  const setSelectByTextOrValue = (selector, wanted) => {
    const el = $(selector);
    if (!el || wanted == null || wanted === "") return false;
    const wantedNorm = norm(wanted);
    const opts = [...el.options];
    let hit = opts.find((o) => norm(o.value) === wantedNorm);
    if (!hit) hit = opts.find((o) => norm(o.textContent) === wantedNorm);
    if (!hit) hit = opts.find((o) => norm(o.textContent).includes(wantedNorm));
    if (!hit) return false;
    el.value = hit.value;
    fire(el);
    return true;
  };

  const resetSelect = (selector) => {
    const el = $(selector);
    if (!el) return false;
    const emptyOpt = [...el.options].find((o) => norm(o.value) === "");
    if (emptyOpt) el.value = emptyOpt.value;
    else el.selectedIndex = 0;
    fire(el);
    return true;
  };

  const parseDOB = (dob) => {
    const s = String(dob || "").trim().replace(/\\//g, "-");
    const m = s.match(/^(\\d{4})-(\\d{1,2})-(\\d{1,2})$/);
    if (!m) return null;
    return { y: m[1], m: String(Number(m[2])), d: String(Number(m[3])) };
  };

  setSelectByTextOrValue("#applicant_passport_country_code", data.passport_country);
  setSelectByTextOrValue("#applicant_birth_country_code", data.birth_country);
  setSelectByTextOrValue("#applicant_permanent_residency_country_code", data.residency_country);

  setInput("#applicant_passport_number", data.passport_number);
  setInput("#applicant_ds160_number", data.ds160_number);
  setSelectByTextOrValue("#applicant_visa_class_id", data.visa_class);

  const dob = parseDOB(data.date_of_birth);
  if (dob) {
    setSelectByTextOrValue("#applicant_date_of_birth_3i", dob.d);
    setSelectByTextOrValue("#applicant_date_of_birth_2i", dob.m);
    setSelectByTextOrValue("#applicant_date_of_birth_1i", dob.y);
  }

  setInput("#applicant_phone1", data.phone);
  setInput("#applicant_email_address", data.email);
  setRadioByBoolean("applicant[is_a_renewal]", data.is_renewal);
  setRadioByBoolean("applicant[traveling_to_apply]", data.traveling_to_apply);

  // 强制禁用短信提醒。
  setCheckbox("#applicant_mobile_alerts", false);
  resetSelect("#applicant_mobile_country_code") || resetSelect("select[name='applicant[mobile_country_code]']");
  clearInput("#applicant_mobile_phone") || clearInput("input[name='applicant[mobile_phone]']");
  setTimeout(() => setCheckbox("#applicant_mobile_alerts", false), 300);

  alert("自动填充执行完成（姓名未填，短信提醒已关闭）");
})();`
}

export function RegisterAISForm() {
  const { showLoginPrompt } = useAuthPrompt()
  const activeApplicant = useActiveApplicantProfile()
  const [profiles, setProfiles] = useState<ApplicantProfileOption[]>([])
  const [groups, setGroups] = useState<AisGroup[]>([])
  const [password, setPassword] = useState("Visa202520252025!")
  const [extraEmail, setExtraEmail] = useState("")
  const [sendEmail, setSendEmail] = useState(true)
  const [batchMode, setBatchMode] = useState<"parallel" | "sequential">("parallel")
  const [autofillJson, setAutofillJson] = useState("")
  const [autofillResult, setAutofillResult] = useState<{ status: "success" | "error"; message: string } | null>(null)
  const [oneClickLoading, setOneClickLoading] = useState(false)
  const [oneClickResult, setOneClickResult] = useState<{ status: "success" | "error"; message: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ status: string; message: string } | null>(null)

  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const res = await fetch("/api/applicants?includeProfiles=1&includeProfileFiles=1", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        setProfiles((data.profiles || []) as ApplicantProfileOption[])
      } catch (error) {
        console.error("Failed to load profiles for AIS:", error)
      }
    }

    void loadProfiles()
  }, [])

  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  )

  const defaultAutofillPayload = useMemo(() => buildExternalAisFormPayload(activeApplicant), [activeApplicant])

  useEffect(() => {
    if (!autofillJson) {
      setAutofillJson(JSON.stringify(defaultAutofillPayload, null, 2))
    }
  }, [defaultAutofillPayload, autofillJson])

  const suggestProfileId = () => {
    const used = new Set(groups.map((group) => group.applicantProfileId).filter(Boolean))
    if (activeApplicant?.id && !used.has(activeApplicant.id)) {
      return activeApplicant.id
    }
    const unused = profiles.find((profile) => !used.has(profile.id))
    return unused?.id || activeApplicant?.id || ""
  }

  const addGroup = (prefillProfileId?: string) => {
    setGroups((current) => [...current, createGroup(prefillProfileId ?? suggestProfileId())])
    setResult(null)
  }

  const updateGroup = (id: string, updates: Partial<AisGroup>) => {
    setGroups((current) => current.map((group) => (group.id === id ? { ...group, ...updates } : group)))
    setResult(null)
  }

  const removeGroup = (id: string) => {
    setGroups((current) => current.filter((group) => group.id !== id))
    setResult(null)
  }

  const getGroupProfile = (group: AisGroup) =>
    group.applicantProfileId ? profileMap.get(group.applicantProfileId) : undefined

  const groupHasExcel = (group: AisGroup) => !!group.excelFile || !!getProfileExcel(getGroupProfile(group))

  const getGroupDisplayName = (group: AisGroup, index: number) => {
    const profile = getGroupProfile(group)
    return profile?.name || profile?.label || `申请组 ${index + 1}`
  }

  const submitOne = async (group: AisGroup) => {
    const formData = new FormData()
    if (group.excelFile) {
      formData.append("excel", group.excelFile)
    }
    if (group.applicantProfileId) {
      formData.append("applicantProfileId", group.applicantProfileId)
      if (activeApplicant?.activeCaseId && group.applicantProfileId === activeApplicant.id) {
        formData.append("caseId", activeApplicant.activeCaseId)
      }
    }
    formData.append("password", password)
    formData.append("send_activation_email", String(sendEmail))
    formData.append("extra_email", extraEmail)

    const res = await fetch("/api/usa-visa/register-ais", { method: "POST", body: formData })
    if (res.status === 401) {
      showLoginPrompt()
      throw new Error("AUTH_REQUIRED")
    }
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || "AIS 注册失败")
    }
    return Array.isArray(data.task_ids) ? data.task_ids.length : 0
  }

  const handleBatchSubmit = async () => {
    const valid = groups.filter(groupHasExcel)
    if (valid.length === 0) {
      setResult({
        status: "error",
        message: "请至少准备一个完整申请组。每组都需要一份 Excel，可以直接使用申请人档案里的 DS-160 / AIS Excel。",
      })
      return
    }

    setLoading(true)
    setResult(null)
    const errors: string[] = []
    let createdTasks = 0

    try {
      if (batchMode === "sequential") {
        for (let index = 0; index < valid.length; index += 1) {
          const group = valid[index]
          try {
            createdTasks += await submitOne(group)
          } catch (error) {
            if (error instanceof Error && error.message === "AUTH_REQUIRED") return
            errors.push(`${getGroupDisplayName(group, index)}: ${error instanceof Error ? error.message : "失败"}`)
          }
        }
      } else {
        const responses = await Promise.allSettled(valid.map((group) => submitOne(group)))
        responses.forEach((response, index) => {
          const group = valid[index]
          if (response.status === "fulfilled") {
            createdTasks += response.value
            return
          }
          if (response.reason?.message === "AUTH_REQUIRED") return
          errors.push(`${getGroupDisplayName(group, index)}: ${response.reason?.message || "失败"}`)
        })
        if (responses.some((response) => response.status === "rejected" && response.reason?.message === "AUTH_REQUIRED")) {
          return
        }
      }

      if (createdTasks > 0 && errors.length === 0) {
        setResult({
          status: "success",
          message: `已创建 ${createdTasks} 个 AIS 注册任务，请在下方任务列表查看进度。`,
        })
        return
      }

      if (createdTasks > 0) {
        setResult({
          status: "error",
          message: `已成功创建 ${createdTasks} 个任务，但有部分申请组失败：${errors.join("；")}`,
        })
        return
      }

      setResult({
        status: "error",
        message: errors.join("；") || "AIS 注册提交失败",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateAutofillJson = () => {
    setAutofillJson(JSON.stringify(defaultAutofillPayload, null, 2))
    setAutofillResult({
      status: "success",
      message: "已使用当前档案生成参数，你可以先微调再复制脚本。",
    })
  }

  const handleCopyAutofillScript = async () => {
    try {
      const parsed = JSON.parse(autofillJson || "{}") as ExternalAisFormPayload
      const script = buildExternalAisScript(parsed)
      await navigator.clipboard.writeText(script)
      setAutofillResult({
        status: "success",
        message: "脚本已复制。打开目标 AIS 页面按 F12，在 Console 粘贴并回车即可执行。",
      })
    } catch (error) {
      setAutofillResult({
        status: "error",
        message: `参数不是合法 JSON：${error instanceof Error ? error.message : "请检查格式"}`,
      })
    }
  }

  const handleOneClickToPayment = async () => {
    if (!activeApplicant?.id) {
      setOneClickResult({
        status: "error",
        message: "请先在页面顶部选择申请人档案。",
      })
      return
    }

    setOneClickLoading(true)
    setOneClickResult(null)
    try {
      const formData = new FormData()
      formData.append("applicantProfileId", activeApplicant.id)
      if (activeApplicant.activeCaseId) {
        formData.append("caseId", activeApplicant.activeCaseId)
      }
      formData.append("password", password || "Visa202520252025!")
      formData.append("send_activation_email", "false")
      formData.append("login_existing", "true")
      formData.append("extra_email", extraEmail)

      const res = await fetch("/api/usa-visa/register-ais", { method: "POST", body: formData })
      if (res.status === 401) {
        showLoginPrompt()
        setOneClickResult({
          status: "error",
          message: "登录已过期，请重新登录后再试。",
        })
        return
      }
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || "一键执行失败")
      }
      const count = Array.isArray(data.task_ids) ? data.task_ids.length : 0
      setOneClickResult({
        status: "success",
        message: `已创建 ${count || 1} 个一键任务。系统会自动推进到 payment 页面并回传截图与链接，请在下方 AIS 注册任务查看结果。`,
      })
    } catch (error) {
      setOneClickResult({
        status: "error",
        message: error instanceof Error ? error.message : "一键执行失败",
      })
    } finally {
      setOneClickLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-blue-200/20 bg-blue-50/10 p-4 dark:bg-blue-900/10">
        <h3 className="mb-2 font-medium text-blue-600 dark:text-blue-400">AIS 账号注册</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          一个申请组对应一个申请人。每组可以直接复用申请人档案里的 Excel，也可以手动上传覆盖。
        </p>
      </Card>

      <Card className="border-[#e5e5ea] dark:border-gray-800 shadow-sm">
        <div className="p-4 space-y-3">
          <h4 className="text-base font-semibold">AIS 一键过桥（外网页自动填表）</h4>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            从当前申请人档案生成参数，并复制“控制台脚本”到剪贴板。到外部 AIS 新申请人页面运行脚本即可自动填充（默认不填姓名、强制关闭短信提醒）。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleGenerateAutofillJson} className="gap-2">
              <Wand2 className="h-4 w-4" />
              用当前档案生成参数
            </Button>
            <Button type="button" onClick={handleCopyAutofillScript} className="gap-2">
              <Copy className="h-4 w-4" />
              复制控制台脚本
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="external-ais-json">外网页自动填表参数 JSON（可手动改）</Label>
            <textarea
              id="external-ais-json"
              value={autofillJson}
              onChange={(event) => setAutofillJson(event.target.value)}
              className="min-h-[180px] w-full rounded-md border border-gray-200 bg-white p-3 font-mono text-xs dark:border-gray-700 dark:bg-gray-900"
              spellCheck={false}
            />
          </div>
          {autofillResult && (
            <Alert variant={autofillResult.status === "success" ? "default" : "destructive"}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{autofillResult.status === "success" ? "脚本准备完成" : "参数有误"}</AlertTitle>
              <AlertDescription>{autofillResult.message}</AlertDescription>
            </Alert>
          )}
        </div>
      </Card>

      <Card className="border-[#e5e5ea] dark:border-gray-800 shadow-sm">
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => addGroup(activeApplicant?.id || "")} className="gap-2">
              <UserRound className="h-4 w-4" />
              用当前档案新增一组
            </Button>
            <Button type="button" variant="outline" onClick={() => addGroup()} className="gap-2">
              <Plus className="h-4 w-4" />
              添加空白申请组
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {groups.length === 0 && (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400 border-2 border-dashed rounded-xl">
            先添加申请组。每个申请组就是一个申请人的 AIS 注册任务。
          </div>
        )}

        {groups.map((group, index) => {
          const profile = getGroupProfile(group)
          const profileExcel = getProfileExcel(profile)
          const hasExcel = groupHasExcel(group)

          return (
            <Card key={group.id} className="border-2 border-[#e5e5ea] dark:border-gray-800">
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold">{getGroupDisplayName(group, index)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">第 {index + 1} 组</div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeGroup(group.id)} className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4 mr-1" />
                    移除
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>选择申请人档案</Label>
                  <Select
                    value={group.applicantProfileId || MANUAL_OPTION}
                    onValueChange={(value) =>
                      updateGroup(group.id, {
                        applicantProfileId: value === MANUAL_OPTION ? "" : value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="直接选择已有申请人档案" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={MANUAL_OPTION}>不使用档案，完全手动上传</SelectItem>
                      {profiles.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name || item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {profile && (
                  <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 p-3 space-y-2 text-sm">
                    <div className="font-medium text-gray-900 dark:text-white">已关联档案：{profile.name || profile.label}</div>
                    <div className="text-gray-600 dark:text-gray-300">
                      档案 Excel：{profileExcel?.originalName || "档案中未上传"}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      AIS 默认复用 DS-160 / AIS Excel。你也可以在下面单独上传当前组使用的 Excel。
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Excel 文件</Label>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(event) => updateGroup(group.id, { excelFile: event.target.files?.[0] || null })}
                    className="block w-full text-sm"
                  />
                  <div className="text-sm">
                    {group.excelFile ? (
                      <p className="text-green-600 dark:text-green-400 flex items-center gap-1">
                        <FileSpreadsheet className="h-4 w-4" />
                        当前上传：{group.excelFile.name}
                      </p>
                    ) : profileExcel ? (
                      <p className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <FileSpreadsheet className="h-4 w-4" />
                        使用档案：{profileExcel.originalName}
                      </p>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">还没有 Excel 文件</p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3 text-sm">
                  <span className={hasExcel ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                    Excel：{hasExcel ? "已就绪" : "缺少"}
                  </span>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {groups.length > 0 && (
        <Card className="border-[#e5e5ea] dark:border-gray-800 shadow-sm">
          <div className="p-4 space-y-4">
            <div>
              <Label htmlFor="password">账号密码</Label>
              <Input
                id="password"
                type="text"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="默认 Visa202520252025!"
                className="mt-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="send-email"
                checked={sendEmail}
                onChange={(event) => setSendEmail(event.target.checked)}
                className="rounded"
              />
              <Label htmlFor="send-email">发送激活邮件</Label>
            </div>

            <div>
              <Label htmlFor="extra-email">抄送邮箱</Label>
              <Input
                id="extra-email"
                type="email"
                value={extraEmail}
                onChange={(event) => setExtraEmail(event.target.value)}
                placeholder="可选"
                className="mt-1"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">提交方式</Label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="ais-batch-mode"
                    checked={batchMode === "parallel"}
                    onChange={() => setBatchMode("parallel")}
                    className="rounded-full"
                  />
                  <span>并行提交，同时处理多个申请人</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="ais-batch-mode"
                    checked={batchMode === "sequential"}
                    onChange={() => setBatchMode("sequential")}
                    className="rounded-full"
                  />
                  <span>顺序提交，一个完成后再处理下一个</span>
                </label>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Button onClick={handleBatchSubmit} disabled={groups.length === 0 || loading} className="w-full py-3">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            正在批量创建 AIS 任务...
          </>
        ) : (
          <>
            <UserPlus className="mr-2 h-5 w-5" />
            批量提交所有申请组
          </>
        )}
      </Button>

      {result && (
        <Alert variant={result.status === "success" ? "default" : "destructive"}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{result.status === "success" ? "提交完成" : "提交失败"}</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}

      <Card className="border-[#e5e5ea] dark:border-gray-800 shadow-sm">
        <div className="p-4 space-y-3">
          <h4 className="text-base font-semibold">AIS 注册后：一键到支付页</h4>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            建议先完成 AIS 注册并确认客户验证成功，再点这个按钮。
          </p>
          <div className="grid grid-cols-1 gap-2 text-xs text-gray-600 dark:text-gray-300 md:grid-cols-3">
            <div className="rounded-md border border-dashed p-2">1. Create Applicant</div>
            <div className="rounded-md border border-dashed p-2">2. Applicants 点 Yes</div>
            <div className="rounded-md border border-dashed p-2">3. 勾选居留条件并 Confirm</div>
            <div className="rounded-md border border-dashed p-2">4. Add Applicants 点 No</div>
            <div className="rounded-md border border-dashed p-2">5. 选择 London 后 Continue</div>
            <div className="rounded-md border border-dashed p-2">6. 到 Payment 并回传截图+链接</div>
          </div>
          <Button type="button" onClick={handleOneClickToPayment} disabled={oneClickLoading} className="gap-2">
            {oneClickLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            一键执行到支付页
          </Button>
          {oneClickResult && (
            <Alert variant={oneClickResult.status === "success" ? "default" : "destructive"}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{oneClickResult.status === "success" ? "任务已启动" : "启动失败"}</AlertTitle>
              <AlertDescription>{oneClickResult.message}</AlertDescription>
            </Alert>
          )}
        </div>
      </Card>
    </div>
  )
}
