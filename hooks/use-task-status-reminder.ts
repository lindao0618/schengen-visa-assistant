"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

type ReminderTask = {
  task_id: string
  status: string
  message?: string
  applicantName?: string
}

interface ReminderOptions<T extends ReminderTask> {
  enabled?: boolean
  getSuccessTitle?: (task: T) => string
  getFailureTitle?: (task: T) => string
  getDescription?: (task: T) => string
}

function sendBrowserNotification(title: string, description: string) {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return
  }

  if (Notification.permission !== "granted") {
    return
  }

  try {
    new Notification(title, { body: description })
  } catch {
    // Ignore browser notification failures and keep toast as the reliable channel.
  }
}

export function useTaskStatusReminder<T extends ReminderTask>(
  tasks: T[],
  options: ReminderOptions<T> = {}
) {
  const previousStatusRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    if (options.enabled === false) {
      previousStatusRef.current = new Map(tasks.map((task) => [task.task_id, task.status]))
      return
    }

    const previousStatuses = previousStatusRef.current
    const nextStatuses = new Map<string, string>()

    for (const task of tasks) {
      const previousStatus = previousStatuses.get(task.task_id)
      const currentStatus = task.status

      if (
        previousStatus &&
        previousStatus !== currentStatus &&
        (currentStatus === "completed" || currentStatus === "failed")
      ) {
        const description =
          options.getDescription?.(task) ||
          task.message ||
          (task.applicantName ? `申请人：${task.applicantName}` : "任务状态已更新")

        if (currentStatus === "completed") {
          const title = options.getSuccessTitle?.(task) || "任务已完成"
          toast.success(title, { description })
          sendBrowserNotification(title, description)
        } else {
          const title = options.getFailureTitle?.(task) || "任务执行失败"
          toast.error(title, { description })
          sendBrowserNotification(title, description)
        }
      }

      nextStatuses.set(task.task_id, currentStatus)
    }

    previousStatusRef.current = nextStatuses
  }, [
    tasks,
    options.enabled,
    options.getDescription,
    options.getFailureTitle,
    options.getSuccessTitle,
  ])
}
