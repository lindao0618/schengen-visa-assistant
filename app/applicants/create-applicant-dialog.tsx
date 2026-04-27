"use client"

import type { Dispatch, SetStateAction } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  CRM_PRIORITY_OPTIONS,
  CRM_REGION_OPTIONS,
  CRM_VISA_TYPE_OPTIONS,
} from "@/lib/applicant-crm-labels"
import { getAppRoleLabel } from "@/lib/access-control"
import { cn } from "@/lib/utils"

export type CreateApplicantForm = {
  name: string
  phone: string
  email: string
  wechat: string
  passportNumber: string
  note: string
  createFirstCase: boolean
  visaTypes: string[]
  applyRegion: string
  priority: string
  travelDate: string
  assignedToUserId: string
}

type AssigneeOption = {
  id: string
  name?: string | null
  email: string
  role: string
}

type CreateApplicantDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  createForm: CreateApplicantForm
  setCreateForm: Dispatch<SetStateAction<CreateApplicantForm>>
  canAssign: boolean
  assigneesLoading: boolean
  availableAssignees: AssigneeOption[]
  creating: boolean
  onCreateApplicant: () => void
}

function toggleVisaTypeSelection(list: string[], value: string) {
  if (list.includes(value)) {
    return list.filter((item) => item !== value)
  }
  return [...list, value]
}

export function CreateApplicantDialog({
  open,
  onOpenChange,
  createForm,
  setCreateForm,
  canAssign,
  assigneesLoading,
  availableAssignees,
  creating,
  onCreateApplicant,
}: CreateApplicantDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>新建申请人</DialogTitle>
          <DialogDescription>
            先建立申请人档案。如果需要，可以同时为同一申请人创建一个或多个 Case。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>姓名</Label>
            <Input
              value={createForm.name}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="例如：李尚耕"
            />
          </div>
          <div className="space-y-2">
            <Label>手机号</Label>
            <Input
              value={createForm.phone}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>邮箱</Label>
            <Input
              value={createForm.email}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>微信</Label>
            <Input
              value={createForm.wechat}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, wechat: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>护照号</Label>
            <Input
              value={createForm.passportNumber}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, passportNumber: event.target.value }))}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>备注</Label>
            <Textarea
              value={createForm.note}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, note: event.target.value }))}
              rows={4}
            />
          </div>
          <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50/80 p-4 md:col-span-2">
            <label className="flex items-start gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-gray-300"
                checked={createForm.createFirstCase}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    createFirstCase: event.target.checked,
                  }))
                }
              />
              <span>
                <span className="block font-medium text-gray-900">创建后立即建立案件</span>
                <span className="mt-1 block text-xs text-gray-500">
                  建档后可以立即进入办理流程。可同时选择多个签证类型，系统会为同一申请人创建多个 Case。
                </span>
              </span>
            </label>

            {createForm.createFirstCase ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <Label>签证类型</Label>
                  <div className="flex flex-wrap gap-2">
                    {CRM_VISA_TYPE_OPTIONS.map((option) => {
                      const active = createForm.visaTypes.includes(option.value)
                      return (
                        <button
                          key={`${option.value}-create-case`}
                          type="button"
                          onClick={() =>
                            setCreateForm((prev) => ({
                              ...prev,
                              visaTypes: toggleVisaTypeSelection(prev.visaTypes, option.value),
                            }))
                          }
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all",
                            active
                              ? "border-blue-700 bg-blue-700 text-white shadow-sm shadow-blue-200"
                              : "border-blue-100 bg-blue-50/70 text-blue-900 hover:border-blue-300 hover:bg-blue-100",
                          )}
                        >
                          <span className={cn("h-2 w-2 rounded-full", active ? "bg-white/90" : "bg-blue-400")} />
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-gray-500">
                    可同时勾选多个签证类型，系统会自动为同一申请人创建多个案件。
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>地区</Label>
                  <Select
                    value={createForm.applyRegion}
                    onValueChange={(value) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        applyRegion: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择地区" />
                    </SelectTrigger>
                    <SelectContent>
                      {CRM_REGION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>优先级</Label>
                  <Select
                    value={createForm.priority}
                    onValueChange={(value) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        priority: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择优先级" />
                    </SelectTrigger>
                    <SelectContent>
                      {CRM_PRIORITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>出行时间</Label>
                  <Input
                    type="date"
                    value={createForm.travelDate}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        travelDate: event.target.value,
                      }))
                    }
                  />
                </div>
                {canAssign ? (
                  <div className="space-y-2 md:col-span-2">
                    <Label>分配给谁</Label>
                    <Select
                      disabled={assigneesLoading}
                      value={createForm.assignedToUserId || "__unset__"}
                      onValueChange={(value) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          assignedToUserId: value === "__unset__" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="暂不分配" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unset__">暂不分配</SelectItem>
                        {availableAssignees.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {(option.name || option.email) + ` (${getAppRoleLabel(option.role)})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {assigneesLoading ? <p className="text-xs text-gray-500">正在加载可分配成员...</p> : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onCreateApplicant} disabled={creating}>
            {creating ? "创建中..." : "创建并进入详情"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
