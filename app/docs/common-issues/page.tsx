"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Search, HelpCircle, FileQuestion, Calendar, CreditCard, StampIcon as Passport, Globe } from "lucide-react"

const categories = [
  { name: "申请流程", icon: <FileQuestion className="h-5 w-5" /> },
  { name: "文件准备", icon: <Passport className="h-5 w-5" /> },
  { name: "预约问题", icon: <Calendar className="h-5 w-5" /> },
  { name: "支付相关", icon: <CreditCard className="h-5 w-5" /> },
  { name: "签证类型", icon: <Globe className="h-5 w-5" /> },
]

const issues = [
  {
    category: "申请流程",
    question: "如何开始申根签证申请流程？",
    answer:
      "申根签证申请流程通常包括以下步骤：1. 确定主申根国 2. 收集所需文件 3. 填写申请表 4. 预约面试 5. 支付签证费 6. 参加面试并提交材料 7. 等待审核结果。建议您至少在计划出发日期前3个月开始准备申请。",
  },
  {
    category: "申请流程",
    question: "申请被拒绝后，多久可以再次申请？",
    answer:
      "通常情况下，没有明确的等待期限制。但建议在解决导致上次申请被拒的问题后再重新申请。如果情况没有实质性变化，立即重新申请可能会再次被拒。建议等待至少3-6个月，并确保新的申请中提供额外的支持文件。",
  },
  {
    category: "文件准备",
    question: "申根签证所需的主要文件有哪些？",
    answer:
      "主要文件包括：1. 有效护照 2. 签证照片 3. 填写完整的申请表 4. 往返机票预订 5. 住宿证明 6. 旅行保险 7. 资金证明 8. 在职证明或学生证明 9. 行程安排。具体要求可能因申请国家和个人情况而异，请查看所申请国家的官方要求。",
  },
  {
    category: "文件准备",
    question: "资金证明需要多少金额？",
    answer:
      "资金证明的金额要求因国家而异，但一般规则是每人每天至少50-100欧元。例如，对于10天的旅行，您可能需要证明至少500-1000欧元的资金。建议提供最近3-6个月的银行对账单，余额应当充足且稳定。",
  },
  {
    category: "预约问题",
    question: "如何预约签证面试？",
    answer:
      "预约签证面试的步骤：1. 访问您所在地区的签证申请中心官网 2. 创建账户或登录 3. 选择签证类型和申请地点 4. 选择合适的日期和时间 5. 填写必要的个人信息 6. 确认预约。请注意，某些热门时段可能需要提前几周甚至几个月预约。",
  },
  {
    category: "预约问题",
    question: "可以更改或取消已经预约的面试时间吗？",
    answer:
      "是的，通常可以更改或取消预约。登录您的账户，找到预约管理选项。但请注意，某些申请中心可能有更改或取消的截止时间限制（如48小时前）。频繁更改可能会影响您的申请，建议谨慎选择初始预约时间。",
  },
  {
    category: "支付相关",
    question: "签证费用是多少？可以退款吗？",
    answer:
      "申根签证的标准费用是80欧元（约合人民币640元，可能会有变动）。6-12岁儿童为40欧元，6岁以下免费。签证费一般不予退还，即使申请被拒绝也是如此。某些类别的申请人（如学生、研究人员）可能有资格获得费用减免，具体情况请咨询申请中心。",
  },
  {
    category: "支付相关",
    question: "可以用哪些方式支付签证费？",
    answer:
      "支付方式因申请中心而异，但通常包括：1. 信用卡/借记卡 2. 银行转账 3. 现金（部分中心可能不接受）。某些申请中心还可能接受支付宝或微信支付。建议在预约时查看可用的支付选项，并在面试当天准备好相应的支付方式。",
  },
  {
    category: "签证类型",
    question: "短期申根签证和长期申根签证有什么区别？",
    answer:
      "短期申根签证（C类）允许在180天内最多停留90天，适用于旅游、商务或短期学习。长期申根签证（D类）允许在申根区停留超过90天，通常用于学习、工作或家庭团聚。长期签证的申请要求更严格，处理时间也可能更长。具体选择取决于您的访问目的和计划停留时间。",
  },
  {
    category: "签证类型",
    question: "多次入境签证和单次入境签证有什么不同？",
    answer:
      "单次入境签证仅允许您在有效期内进入申根区一次。离开申根区后，该签证即失效。多次入境签证允许您在签证有效期内多次进出申根区，只要每次停留不超过允许的天数即可。多次入境签证通常授予有经常出行需求或良好签证记录的申请人。",
  },
]

export default function CommonIssuesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const filteredIssues = issues.filter(
    (issue) =>
      (selectedCategory ? issue.category === selectedCategory : true) &&
      (issue.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.answer.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">帮助中心</Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">常见问题与解决方案</h1>
          <p className="text-xl text-gray-400 mb-8 max-w-3xl mx-auto">
            找不到您需要的答案？别担心，我们随时为您提供支持。
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="搜索常见问题..."
              className="pl-10 bg-zinc-900 border-zinc-800 text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {categories.map((category) => (
            <Button
              key={category.name}
              variant={selectedCategory === category.name ? "default" : "outline"}
              className={`${
                selectedCategory === category.name
                  ? "bg-emerald-500 hover:bg-emerald-600"
                  : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
              } text-white`}
              onClick={() => setSelectedCategory(selectedCategory === category.name ? null : category.name)}
            >
              {category.icon}
              <span className="ml-2">{category.name}</span>
            </Button>
          ))}
        </div>

        {/* Issues and Solutions */}
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full space-y-4">
            {filteredIssues.map((issue, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden"
              >
                <AccordionTrigger className="px-6 py-4 hover:bg-zinc-800 transition-colors">
                  <div className="flex items-center text-left">
                    <HelpCircle className="h-5 w-5 text-emerald-500 mr-3 flex-shrink-0" />
                    <span>{issue.question}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 py-4 bg-zinc-800">
                  <p className="text-gray-300">{issue.answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Contact Support CTA */}
        <Card className="max-w-2xl mx-auto mt-16 bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-2xl">还有疑问？</CardTitle>
            <CardDescription>我们的支持团队随时为您服务</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-emerald-500 hover:bg-emerald-600">联系客户支持</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

