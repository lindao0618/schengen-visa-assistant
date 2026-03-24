"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Check, X, Building2, Zap, Shield, Users } from "lucide-react"

const plans = [
  {
    name: "基础版",
    price: "99",
    description: "适合个人签证申请",
    features: ["基础签证指南", "申请材料清单", "社区基础访问权限", "基础AI助手支持"],
    badge: "",
  },
  {
    name: "专业版",
    price: "299",
    description: "适合经常出国的用户",
    features: ["所有基础版功能", "优先AI助手支持", "材料专业审核", "预约加急服务", "签证面试模拟"],
    badge: "最受欢迎",
  },
  {
    name: "商务版",
    price: "999",
    description: "适合企业和团队",
    features: ["所有专业版功能", "团队成员管理", "专属客服支持", "批量签证办理", "加急通道", "团队折扣"],
    badge: "企业优选",
  },
]

const features = [
  { name: "基础签证指南", basic: true, pro: true, business: true },
  { name: "申请材料清单", basic: true, pro: true, business: true },
  { name: "社区访问权限", basic: true, pro: true, business: true },
  { name: "AI助手支持", basic: "基础", pro: "优先", business: "24/7专属" },
  { name: "材料审核", basic: false, pro: true, business: true },
  { name: "预约加急服务", basic: false, pro: true, business: true },
  { name: "签证面试模拟", basic: false, pro: true, business: true },
  { name: "团队成员管理", basic: false, pro: false, business: true },
  { name: "专属客服支持", basic: false, pro: false, business: true },
  { name: "批量签证办理", basic: false, pro: false, business: true },
]

const faqs = [
  {
    question: "如何选择适合我的套餐？",
    answer:
      "如果您是个人申请签证，建议选择基础版；如果您经常出国或需要更多支持，可以选择专业版；如果您是企业或团队，建议选择商务版以获得更多团队相关功能。",
  },
  {
    question: "可以随时更换套餐吗？",
    answer: "是的，您可以随时升级或降级您的套餐。升级会立即生效，降级将在当前计费周期结束后生效。",
  },
  {
    question: "是否提供退款？",
    answer: "我们提供7天无理由退款保证。如果您对服务不满意，可以在购买后7天内申请全额退款。",
  },
  {
    question: "商务版可以添加多少团队成员？",
    answer: "商务版基础可添加10名团队成员，如需更多名额可联系客服定制方案。",
  },
]

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false)

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-16 pt-24">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">选择适合您的方案</h1>
          <p className="text-gray-400 max-w-2xl mx-auto mb-8">
            我们提供多种套餐选择，满足不同用户的需求。所有套餐都包含核心功能，助您顺利完成签证申请。
          </p>
          <div className="flex items-center justify-center space-x-4">
            <span className={`text-sm ${!isAnnual ? "text-white" : "text-gray-400"}`}>月付</span>
            <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
            <span className={`text-sm ${isAnnual ? "text-white" : "text-gray-400"}`}>
              年付
              <Badge variant="outline" className="ml-2 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                省20%
              </Badge>
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan) => (
            <Card key={plan.name} className="bg-zinc-900 border-zinc-800 relative">
              {plan.badge && <Badge className="absolute -top-2 right-4 bg-emerald-500">{plan.badge}</Badge>}
              <CardHeader>
                <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                <CardDescription className="text-gray-400">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <span className="text-4xl font-bold">
                    ¥{isAnnual ? Number.parseInt(plan.price) * 10 : plan.price}
                  </span>
                  <span className="text-gray-400">/{isAnnual ? "年" : "月"}</span>
                </div>
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-gray-300">
                      <Check className="h-5 w-5 text-emerald-500 mr-2" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full bg-emerald-500 hover:bg-emerald-600">选择{plan.name}</Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Feature Comparison */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-8 text-center">功能对比</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-white">功能</TableHead>
                  <TableHead className="text-white">基础版</TableHead>
                  <TableHead className="text-white">专业版</TableHead>
                  <TableHead className="text-white">商务版</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {features.map((feature) => (
                  <TableRow key={feature.name} className="border-zinc-800">
                    <TableCell className="text-gray-300">{feature.name}</TableCell>
                    <TableCell>
                      {typeof feature.basic === "boolean" ? (
                        feature.basic ? (
                          <Check className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <X className="h-5 w-5 text-gray-500" />
                        )
                      ) : (
                        <span className="text-gray-300">{feature.basic}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {typeof feature.pro === "boolean" ? (
                        feature.pro ? (
                          <Check className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <X className="h-5 w-5 text-gray-500" />
                        )
                      ) : (
                        <span className="text-gray-300">{feature.pro}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {typeof feature.business === "boolean" ? (
                        feature.business ? (
                          <Check className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <X className="h-5 w-5 text-gray-500" />
                        )
                      ) : (
                        <span className="text-gray-300">{feature.business}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <Zap className="h-8 w-8 text-emerald-500 mb-2" />
              <CardTitle className="text-lg">快速处理</CardTitle>
              <CardDescription className="text-gray-400">加急通道确保您的申请得到优先处理</CardDescription>
            </CardHeader>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <Shield className="h-8 w-8 text-emerald-500 mb-2" />
              <CardTitle className="text-lg">安全保障</CardTitle>
              <CardDescription className="text-gray-400">全程保护您的个人信息和申请资料</CardDescription>
            </CardHeader>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <Users className="h-8 w-8 text-emerald-500 mb-2" />
              <CardTitle className="text-lg">专业支持</CardTitle>
              <CardDescription className="text-gray-400">经验丰富的团队为您提供支持</CardDescription>
            </CardHeader>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <Building2 className="h-8 w-8 text-emerald-500 mb-2" />
              <CardTitle className="text-lg">企业定制</CardTitle>
              <CardDescription className="text-gray-400">为企业客户提供定制化解决方案</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">常见问题</h2>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border-zinc-800">
                <AccordionTrigger className="text-white hover:text-emerald-500">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-gray-400">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Enterprise CTA */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold mb-4">需要企业定制方案？</h2>
          <p className="text-gray-400 mb-8">我们可以根据您的企业需求提供定制化的解决方案</p>
          <Button className="bg-emerald-500 hover:bg-emerald-600">联系我们</Button>
        </div>
      </div>
    </div>
  )
}

