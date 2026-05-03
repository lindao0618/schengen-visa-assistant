"use client"

import type { ChangeEvent, KeyboardEvent } from "react"
import { useEffect, useRef, useState } from "react"
import { Bot, Globe2, Loader2, MapPin, Send, Sparkles, User, UserRoundCheck } from "lucide-react"

import { ProCard } from "@/components/pro-ui/pro-card"
import { ProShell } from "@/components/pro-ui/pro-shell"
import { ProStatus } from "@/components/pro-ui/pro-status"

type MessageType = {
  type: "user" | "assistant"
  content: string
  isTyping?: boolean
}

const selectClass =
  "w-full rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-3 text-sm text-white outline-none transition focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20"

const filterGroups = [
  {
    id: "visa-type",
    label: "签证类型",
    icon: Sparkles,
    options: [
      ["", "请选择类型"],
      ["student", "学生签证"],
      ["tourist", "旅游签证"],
      ["business", "商务签证"],
      ["work", "工作签证"],
      ["family", "家庭团聚签证"],
    ],
  },
  {
    id: "country",
    label: "申请国家",
    icon: Globe2,
    options: [
      ["", "请选择国家"],
      ["uk", "英国"],
      ["us", "美国"],
      ["france", "法国"],
      ["canada", "加拿大"],
      ["australia", "澳大利亚"],
      ["japan", "日本"],
      ["korea", "韩国"],
      ["newzealand", "新西兰"],
    ],
  },
  {
    id: "location",
    label: "所在地",
    icon: MapPin,
    options: [
      ["china", "中国大陆"],
      ["uk", "英国"],
      ["us", "美国"],
      ["australia", "澳大利亚"],
      ["europe", "欧洲"],
      ["newzealand", "新西兰"],
      ["canada", "加拿大"],
    ],
  },
  {
    id: "applicant-status",
    label: "申请人身份",
    icon: UserRoundCheck,
    options: [
      ["student", "学生"],
      ["employed", "在职"],
      ["retired", "退休"],
      ["freelancer", "自由职业"],
      ["unemployed", "待业"],
    ],
  },
]

export default function AIAssistantClientPage() {
  const [inputValue, setInputValue] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [messages, setMessages] = useState<MessageType[]>([
    {
      type: "assistant",
      content: `我可以帮助你解答关于<strong>英国、美国、申根、法国</strong>等国家的签证问题，包括：

- 签证申请流程和材料准备
- 资金证明和财务要求
- 面试技巧和常见问题
- 时间规划和注意事项
- 拒签原因分析和申诉建议

请问有什么可以帮助你的吗？`,
    },
  ])

  const [visaType, setVisaType] = useState("")
  const [country, setCountry] = useState("")
  const [location, setLocation] = useState("china")
  const [applicantStatus, setApplicantStatus] = useState("student")

  const chatContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [inputValue])

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
  }

  const formatContent = (content: string) => {
    if (!content) return { __html: "" }

    const processedContent = content
      .replace(/\n##\s+([^\n]+)/g, '</p><p class="font-semibold text-lg mt-3 mb-1 text-white">$1</p><p>')
      .replace(/\n#\s+([^\n]+)/g, '</p><p class="font-semibold text-xl mt-3 mb-2 text-white">$1</p><p>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n\[([^\]]+)\]/g, '</p><p class="font-semibold mt-2 mb-1 text-white">$1</p><p>')
      .replace(/\n【([^】]+)】/g, '</p><p class="font-semibold mt-2 mb-1 text-white">$1</p><p>')
      .replace(/\n(\d+)\. ([^\n]+)/g, "</p><p>$1. $2")
      .replace(/\n- ([^\n]+)/g, "</p><p>• $1")
      .replace(/\n/g, "<br/>")

    return { __html: `<p>${processedContent}</p>` }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return

    const userMessage = {
      type: "user" as const,
      content: inputValue,
    }

    setMessages((prev) => [...prev, userMessage])
    setIsProcessing(true)

    const question = inputValue
    setInputValue("")

    const tempIndex = messages.length + 1
    setMessages((prev) => [
      ...prev,
      {
        type: "assistant",
        content: "",
        isTyping: true,
      },
    ])

    try {
      console.log("发送请求到API:", {
        question,
        visa_type: visaType,
        country,
        applicant_location: location,
        applicant_status: applicantStatus,
        use_rag: true,
      })

      const response = await fetch("http://localhost:8000/ask-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question,
          visa_type: visaType,
          country: country,
          applicant_location: location,
          applicant_status: applicantStatus,
          use_rag: true,
        }),
      })

      if (!response.ok) {
        throw new Error(`网络请求失败: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("无法读取响应流")

      const decoder = new TextDecoder()
      let content = ""

      setMessages((prev) => {
        const newMessages = [...prev]
        newMessages[tempIndex] = {
          type: "assistant",
          content: "",
          isTyping: true,
        }
        return newMessages
      })

      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk

        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const jsonStr = line.substring(6)
              if (jsonStr.trim() === "[DONE]") {
                break
              }

              const data = JSON.parse(jsonStr)
              if (data.content) {
                content += data.content

                setMessages((prev) => {
                  const newMessages = [...prev]
                  newMessages[tempIndex] = {
                    type: "assistant",
                    content: content,
                    isTyping: true,
                  }
                  return newMessages
                })

                await new Promise((resolve) => setTimeout(resolve, 20))
              }
            } catch (e) {
              console.warn("解析SSE数据失败:", line)
            }
          }
        }
      }

      setMessages((prev) => {
        const newMessages = [...prev]
        newMessages[tempIndex] = {
          type: "assistant",
          content: content,
          isTyping: false,
        }
        return newMessages
      })
    } catch (error) {
      console.error("请求错误:", error)
      setMessages((prev) => {
        const newMessages = [...prev]
        newMessages[tempIndex] = {
          type: "assistant",
          content: `<div style="color: #fecaca; padding: 12px; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(248, 113, 113, 0.25); border-radius: 16px;">抱歉，连接服务器失败: ${
            error instanceof Error ? error.message : "未知错误"
          }。请确保后端服务器已启动。</div>`,
          isTyping: false,
        }
        return newMessages
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <ProShell>
      <style jsx global>{`
        .typing-cursor {
          display: inline-block;
          width: 2px;
          height: 1.2em;
          background-color: currentColor;
          margin-left: 2px;
          vertical-align: middle;
          animation: blink 1s step-end infinite;
        }
        @keyframes blink {
          from,
          to {
            opacity: 1;
          }
          50% {
            opacity: 0;
          }
        }
      `}</style>

      <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <ProStatus tone="info">Context Matrix</ProStatus>
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">签证 AI 控制台</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/48">
              结合签证类型、目的国、所在地和身份背景，为每一次申请生成更贴近场景的答复。
            </p>
          </div>
        </div>
        <ProStatus tone={isProcessing ? "warning" : "online"}>{isProcessing ? "Thinking" : "Engine Ready"}</ProStatus>
      </div>

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <ProCard className="h-fit p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Context Matrix</h2>
              <p className="text-xs text-white/35">用于约束 AI 答复范围</p>
            </div>
          </div>

          <div className="space-y-4">
            {filterGroups.map((group) => {
              const value =
                group.id === "visa-type"
                  ? visaType
                  : group.id === "country"
                    ? country
                    : group.id === "location"
                      ? location
                      : applicantStatus
              const onChange =
                group.id === "visa-type"
                  ? setVisaType
                  : group.id === "country"
                    ? setCountry
                    : group.id === "location"
                      ? setLocation
                      : setApplicantStatus

              return (
                <label key={group.id} htmlFor={group.id} className="block space-y-2">
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/38">
                    <group.icon className="h-3.5 w-3.5" />
                    {group.label}
                  </span>
                  <select id={group.id} value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
                    {group.options.map(([optionValue, label]) => (
                      <option key={optionValue} value={optionValue} className="bg-black text-white">
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              )
            })}
          </div>
        </ProCard>

        <ProCard className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-black">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-white">Visa Intelligence Stream</h2>
                <p className="text-xs text-white/35">RAG-assisted visa consultation</p>
              </div>
            </div>
            <span className="hidden text-[10px] font-bold uppercase tracking-[0.2em] text-white/25 sm:inline">
              VISTORIA 618 PRO
            </span>
          </div>

          <div ref={chatContainerRef} className="custom-scrollbar h-[520px] space-y-5 overflow-y-auto bg-black/20 p-5">
            {messages.map((message, index) => (
              <div key={index} className={`flex gap-3 ${message.type === "user" ? "justify-end" : "justify-start"}`}>
                {message.type === "assistant" ? (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black">
                    <Bot className="h-5 w-5" />
                  </div>
                ) : null}

                <div className={getProMessageClass(message.type)}>
                  {message.content ? (
                    <div
                      className="prose prose-invert max-w-none text-sm leading-7 prose-p:my-0 prose-strong:text-white"
                      dangerouslySetInnerHTML={
                        message.type === "assistant" ? formatContent(message.content) : { __html: message.content }
                      }
                    />
                  ) : (
                    <div className="flex items-center gap-2 text-white/50">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>AI 正在思考中...</span>
                    </div>
                  )}
                  {message.isTyping && message.content ? <span className="typing-cursor">|</span> : null}
                </div>

                {message.type === "user" ? (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
                    <User className="h-5 w-5" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-end gap-3">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="请输入您的签证问题..."
                className="min-h-[52px] max-h-[200px] flex-1 resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20"
                rows={1}
              />
              <button
                onClick={handleSendMessage}
                disabled={isProcessing || !inputValue.trim()}
                className="inline-flex h-[52px] items-center gap-2 rounded-2xl bg-white px-5 text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">发送</span>
              </button>
            </div>
          </div>
        </ProCard>
      </div>
    </ProShell>
  )
}

function getProMessageClass(type: MessageType["type"]) {
  if (type === "user") {
    return "max-w-[82%] rounded-[24px] border border-blue-400/20 bg-blue-500 px-5 py-4 text-white shadow-[0_16px_40px_rgba(59,130,246,0.18)]"
  }

  return "max-w-[82%] rounded-[24px] border border-white/10 bg-white/[0.06] px-5 py-4 text-white/75 backdrop-blur-xl"
}
