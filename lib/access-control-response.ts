import { NextResponse } from "next/server"

export function applicantWriteForbiddenResponse() {
  return NextResponse.json(
    { error: "当前角色无权修改申请人资料" },
    { status: 403 },
  )
}

export function caseWriteForbiddenResponse() {
  return NextResponse.json(
    { error: "当前角色无权修改案件信息" },
    { status: 403 },
  )
}

export function assigneeReadForbiddenResponse() {
  return NextResponse.json(
    { error: "当前角色无权查看可分配成员列表" },
    { status: 403 },
  )
}
