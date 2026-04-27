"use client"

import { Check } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  getApplicantCrmRegionLabel,
  getApplicantCrmVisaTypeLabel,
} from "@/lib/applicant-crm-labels"
import {
  type ApplicantSelectorViewProfile,
  formatApplicantSelectorDateTime,
  getApplicantBusinessTagBadge,
  getApplicantPassportTail,
  getApplicantSelectorSearchValue,
  hasReusableApplicantMaterials,
} from "@/lib/applicant-profile-selector-view"
import { cn } from "@/lib/utils"

type ApplicantProfileSelectorCommandProps = {
  recentProfiles: ApplicantSelectorViewProfile[]
  mineProfiles: ApplicantSelectorViewProfile[]
  otherProfiles: ApplicantSelectorViewProfile[]
  selectedId: string
  onProfileChange: (value: string) => void
}

function ApplicantOptionRow({
  profile,
  selected,
}: {
  profile: ApplicantSelectorViewProfile
  selected: boolean
}) {
  const secondaryParts = [
    getApplicantCrmVisaTypeLabel(profile.visaType),
    getApplicantCrmRegionLabel(profile.region),
    getApplicantPassportTail(profile) ? `护照尾号 ${getApplicantPassportTail(profile)}` : "",
  ].filter((item) => item && item !== "-")

  const businessTag = getApplicantBusinessTagBadge(profile.businessTag)

  return (
    <div className="group flex w-full items-start gap-3 rounded-2xl border border-transparent px-1 py-1 transition-colors">
      <div
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          selected
            ? "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-200"
            : "border-gray-300 bg-white text-transparent",
        )}
      >
        <Check className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-gray-900">{profile.name || profile.label}</span>
          {businessTag && (
            <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5", businessTag.className)}>
              {businessTag.label}
            </Badge>
          )}
          {profile.usVisa?.aaCode && (
            <Badge variant="outline" className="rounded-full border-blue-200 bg-blue-50 text-blue-700">
              AA {profile.usVisa.aaCode}
            </Badge>
          )}
          {hasReusableApplicantMaterials(profile) && (
            <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700">
              资料可复用
            </Badge>
          )}
        </div>
        {secondaryParts.length > 0 && <div className="text-xs text-gray-500">{secondaryParts.join(" · ")}</div>}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
          {profile.phone && <span>{profile.phone}</span>}
          {!profile.phone && profile.email && <span>{profile.email}</span>}
          {!profile.phone && !profile.email && profile.wechat && <span>微信 {profile.wechat}</span>}
          <span>{formatApplicantSelectorDateTime(profile.updatedAt)}</span>
        </div>
      </div>
    </div>
  )
}

function renderGroup({
  heading,
  keyPrefix,
  profiles,
  selectedId,
  onProfileChange,
}: {
  heading: string
  keyPrefix: string
  profiles: ApplicantSelectorViewProfile[]
  selectedId: string
  onProfileChange: (value: string) => void
}) {
  if (profiles.length === 0) return null

  return (
    <CommandGroup heading={heading}>
      {profiles.map((profile) => (
        <CommandItem
          key={`${keyPrefix}-${profile.id}`}
          value={getApplicantSelectorSearchValue(profile)}
          onSelect={() => onProfileChange(profile.id)}
          className="items-start px-3 py-3"
        >
          <ApplicantOptionRow profile={profile} selected={profile.id === selectedId} />
        </CommandItem>
      ))}
    </CommandGroup>
  )
}

export function ApplicantProfileSelectorCommand({
  recentProfiles,
  mineProfiles,
  otherProfiles,
  selectedId,
  onProfileChange,
}: ApplicantProfileSelectorCommandProps) {
  return (
    <Command>
      <CommandInput placeholder="搜索姓名、护照尾号、手机号或微信号..." />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>没有找到匹配的申请人</CommandEmpty>

        {renderGroup({
          heading: "最近使用",
          keyPrefix: "recent",
          profiles: recentProfiles,
          selectedId,
          onProfileChange,
        })}

        {recentProfiles.length > 0 && mineProfiles.length > 0 && <CommandSeparator />}

        {renderGroup({
          heading: "我负责的",
          keyPrefix: "mine",
          profiles: mineProfiles,
          selectedId,
          onProfileChange,
        })}

        {(recentProfiles.length > 0 || mineProfiles.length > 0) && otherProfiles.length > 0 && <CommandSeparator />}

        {renderGroup({
          heading: "全部申请人",
          keyPrefix: "all",
          profiles: otherProfiles,
          selectedId,
          onProfileChange,
        })}
      </CommandList>
    </Command>
  )
}
