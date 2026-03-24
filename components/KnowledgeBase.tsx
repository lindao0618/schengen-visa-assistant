import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

const faqData = [
  {
    question: "申根签证是什么？",
    answer: "申根签证是允许持有人在申根区自由旅行的统一签证。申根区包括26个欧洲国家。",
  },
  {
    question: "申请法国签证需要哪些文件？",
    answer:
      "通常需要护照、照片、申请表、往返机票预订、住宿证明、财务证明、旅行保险等。具体要求可能会变化，请查看法国使馆官网。",
  },
  {
    question: "签证处理时间大约需要多久？",
    answer: "处理时间通常为15天左右，但可能会更长。建议至少在计划出发日期前3个月申请。",
  },
]

export function KnowledgeBase() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="max-w-3xl mx-auto mt-8">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">常见问题</h2>
      {faqData.map((item, index) => (
        <div key={index} className="mb-4 border-b dark:border-gray-700">
          <button
            className="flex justify-between items-center w-full text-left p-4 focus:outline-none"
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
          >
            <span className="font-medium text-gray-700 dark:text-gray-300">{item.question}</span>
            {openIndex === index ? <ChevronUp /> : <ChevronDown />}
          </button>
          {openIndex === index && <p className="p-4 text-gray-600 dark:text-gray-400">{item.answer}</p>}
        </div>
      ))}
    </div>
  )
}

