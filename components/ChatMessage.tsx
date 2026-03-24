import type { Message } from "ai"
import { User, Bot } from "lucide-react"

export function ChatMessage({ message }: { message: Message }) {
  return (
    <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`flex items-start max-w-3/4 ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full ${message.role === "user" ? "bg-emerald-500 ml-2" : "bg-zinc-700 mr-2"}`}
        >
          {message.role === "user" ? (
            <User size={18} className="text-white" />
          ) : (
            <Bot size={18} className="text-white" />
          )}
        </div>
        <div
          className={`p-3 rounded-lg ${
            message.role === "user"
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-zinc-800 text-gray-200"
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    </div>
  )
}
