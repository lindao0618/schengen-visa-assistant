"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  FileText,
  CheckCircle,
  AlertCircle,
  Download,
  Shield,
  Loader2,
} from "lucide-react"
import { getCountryLabel, getStaticChecklist, isFrance, type MaterialItem, type CountryChecklist } from "@/lib/schengen-materials"

const FRANCE_VISA_TYPES = [
  { value: "short_stay", label: "短期停留" },
  { value: "long_stay", label: "长期停留" },
  { value: "student", label: "学生签证" },
  { value: "work", label: "工作签证" },
]

const COUNTRY_FLAGS: Record<string, string> = {
  france: "https://flagcdn.com/w80/fr.png",
  germany: "https://flagcdn.com/w80/de.png",
  italy: "https://flagcdn.com/w80/it.png",
  spain: "https://flagcdn.com/w80/es.png",
  netherlands: "https://flagcdn.com/w80/nl.png",
  switzerland: "https://flagcdn.com/w80/ch.png",
  austria: "https://flagcdn.com/w80/at.png",
  belgium: "https://flagcdn.com/w80/be.png",
  portugal: "https://flagcdn.com/w80/pt.png",
  greece: "https://flagcdn.com/w80/gr.png",
}

function toChecklistItems(required: { id: string; name: string; description: string }[], optional: { id: string; name: string; description: string }[]): { required: MaterialItem[]; optional: MaterialItem[] } {
  return {
    required: required.map((r) => ({ id: r.id, name: r.name, description: r.description, example: (r as { example?: string }).example })),
    optional: optional.map((o) => ({ id: o.id, name: o.name, description: o.description, example: (o as { example?: string }).example })),
  }
}

export default function CountryMaterialsPage() {
  const params = useParams()
  const router = useRouter()
  const countrySlug = (params?.country as string) ?? ""
  const [franceVisaType, setFranceVisaType] = useState("short_stay")
  const [checklist, setChecklist] = useState<CountryChecklist | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  const label = getCountryLabel(countrySlug)
  const flag = COUNTRY_FLAGS[countrySlug]

  useEffect(() => {
    if (!countrySlug) return
    if (isFrance(countrySlug)) {
      setLoading(true)
      fetch(`/api/schengen/france/checklist?visaType=${franceVisaType}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.required && data.optional) {
            setChecklist(toChecklistItems(data.required, data.optional))
          } else {
            setChecklist(null)
          }
        })
        .catch(() => setChecklist(null))
        .finally(() => setLoading(false))
    } else {
      setChecklist(getStaticChecklist(countrySlug))
    }
  }, [countrySlug, franceVisaType])

  const allItems = checklist ? [...checklist.required, ...checklist.optional] : []
  const requiredIds = new Set(checklist?.required.map((r) => r.id) ?? [])
  const total = allItems.length
  const checked = checkedIds.size
  const progress = total ? Math.round((checked / total) * 100) : 0
  const requiredChecked = allItems.filter((i) => requiredIds.has(i.id) && checkedIds.has(i.id)).length
  const requiredTotal = checklist?.required.length ?? 0

  const toggle = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => setCheckedIds(new Set(allItems.map((i) => i.id)))
  const clearAll = () => setCheckedIds(new Set())
  const selectRequiredOnly = () => setCheckedIds(new Set(checklist?.required.map((r) => r.id) ?? []))

  const handleExport = () => {
    const lines = ["材料清单", `国家：${label}`, "", "已勾选：", ...allItems.filter((i) => checkedIds.has(i.id)).map((i) => `- ${i.name}`)]
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `申根材料-${label}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!countrySlug) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black flex items-center justify-center">
        <p className="text-gray-500">无效国家</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/schengen-visa/materials">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            {flag && (
              <div className="relative w-10 h-10 rounded-lg overflow-hidden">
                <Image src={flag} alt={label} width={40} height={40} className="object-cover" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{label} 申根材料清单</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">勾选已准备的材料，跟踪进度</p>
            </div>
          </div>
        </div>

        {isFrance(countrySlug) && (
          <Card className="mb-6 border-gray-200/50 dark:border-gray-800/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">签证类型：</span>
                <Select value={franceVisaType} onValueChange={setFranceVisaType}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FRANCE_VISA_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}

        {!loading && checklist && (
          <>
            <Card className="backdrop-blur-md bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-black border border-gray-200/50 dark:border-gray-800/50 shadow-2xl rounded-2xl overflow-hidden mb-6">
              <CardHeader className="border-b border-gray-100 dark:border-gray-800/50">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  准备进度
                </CardTitle>
                <CardDescription>已勾选 {checked}/{total} 项，必需 {requiredChecked}/{requiredTotal}</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <Progress value={progress} className="h-2 mb-4" />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll} className="gap-1">
                    <CheckCircle className="h-4 w-4" />
                    全选
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearAll} className="gap-1">
                    <AlertCircle className="h-4 w-4" />
                    清空
                  </Button>
                  <Button variant="outline" size="sm" onClick={selectRequiredOnly} className="gap-1">
                    <Shield className="h-4 w-4" />
                    只选必需
                  </Button>
                  <Button size="sm" onClick={handleExport} className="gap-1 ml-auto">
                    <Download className="h-4 w-4" />
                    导出清单
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="backdrop-blur-md bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-black border border-gray-200/50 dark:border-gray-800/50 shadow-2xl rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-gray-100 dark:border-gray-800/50">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  材料清单
                </CardTitle>
                <CardDescription>按类别勾选已准备的材料</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">必需材料</h3>
                  <ul className="space-y-3">
                    {checklist.required.map((item) => (
                      <MaterialRow key={item.id} item={item} checked={checkedIds.has(item.id)} onToggle={() => toggle(item.id)} required />
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">可选材料</h3>
                  <ul className="space-y-3">
                    {checklist.optional.map((item) => (
                      <MaterialRow key={item.id} item={item} checked={checkedIds.has(item.id)} onToggle={() => toggle(item.id)} />
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {!loading && !checklist && !isFrance(countrySlug) && (
          <Card className="border-gray-200/50">
            <CardContent className="py-8 text-center text-gray-500">
              暂未配置该国家的材料清单，请稍后再试或联系管理员。
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function MaterialRow({
  item,
  checked,
  onToggle,
  required,
}: {
  item: MaterialItem
  checked: boolean
  onToggle: () => void
  required?: boolean
}) {
  return (
    <li
      className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
        checked ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50" : "bg-white dark:bg-gray-900/50 border-gray-200/50 dark:border-gray-800/50"
      }`}
    >
      <Checkbox id={item.id} checked={checked} onCheckedChange={onToggle} className="mt-1" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor={item.id} className={`font-medium cursor-pointer ${checked ? "text-green-800 dark:text-green-200 line-through" : "text-gray-900 dark:text-gray-100"}`}>
            {item.name}
          </label>
          {required && (
            <Badge variant="destructive" className="text-xs">
              必需
            </Badge>
          )}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{item.description}</p>
        {item.example && <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">示例：{item.example}</p>}
      </div>
      {checked && <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />}
    </li>
  )
}
