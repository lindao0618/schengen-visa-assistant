"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Building2, Users, Zap, Shield, Globe, CheckCircle, ArrowRight } from "lucide-react"

const services = [
  {
    icon: <Building2 className="h-8 w-8 text-emerald-500" />,
    title: "企业定制方案",
    description: "根据您公司的具体需求，提供量身定制的签证服务解决方案。",
  },
  {
    icon: <Users className="h-8 w-8 text-emerald-500" />,
    title: "团队账户管理",
    description: "轻松管理多个员工账户，统一控制和监督签证申请进度。",
  },
  {
    icon: <Zap className="h-8 w-8 text-emerald-500" />,
    title: "快速通道服务",
    description: "为您的重要商务旅行提供加急处理，确保及时获得签证。",
  },
  {
    icon: <Shield className="h-8 w-8 text-emerald-500" />,
    title: "合规性保障",
    description: "确保所有签证申请符合最新的国际旅行规定和目的地国家要求。",
  },
  {
    icon: <Globe className="h-8 w-8 text-emerald-500" />,
    title: "全球支持",
    description: "无论您的员工前往何处，我们都能提供全面的签证支持服务。",
  },
  {
    icon: <CheckCircle className="h-8 w-8 text-emerald-500" />,
    title: "成功率保证",
    description: "凭借我们的专业知识，显著提高您的签证申请成功率。",
  },
]

const caseStudies = [
  {
    company: "科技创新有限公司",
    challenge: "需要为50名员工快速办理多国签证，以参加全球技术峰会。",
    solution: "提供一站式团队签证服务，包括加急处理和全程跟踪。",
    result: "100%的员工成功获得签证，按时参加峰会，节省了大量时间和资源。",
  },
  {
    company: "跨国贸易集团",
    challenge: "经常需要为不同国家的商务访问申请签证，流程复杂且耗时。",
    solution: "定制企业账户，提供预填表格和快速审核服务。",
    result: "签证处理时间减少50%，显著提高了业务效率和员工满意度。",
  },
  {
    company: "教育交流基金会",
    challenge: "组织大规模国际学生交换项目，需要处理大量签证申请。",
    solution: "提供批量签证申请服务和专属客户经理。",
    result: "成功率提升至98%，简化了整个交换项目的组织流程。",
  },
]

const faqs = [
  {
    question: "企业服务与个人服务有何不同？",
    answer: "企业服务提供更多定制化选项，包括团队账户管理、批量处理、专属客户经理等，以满足公司的特定需求。",
  },
  {
    question: "如何为我的公司选择合适的方案？",
    answer:
      "我们会根据您公司的规模、行业、常用目的地国家等因素，为您量身定制最合适的方案。您可以通过咨询我们的企业服务专员获得建议。",
  },
  {
    question: "是否提供紧急签证服务？",
    answer: "是的，我们为企业客户提供快速通道服务，可以加急处理紧急的签证申请。具体处理时间取决于目的地国家的政策。",
  },
  {
    question: "如何确保我们公司的信息安全？",
    answer: "我们采用先进的加密技术保护您的数据，严格遵守数据保护法规，并提供安全的企业账户管理系统。",
  },
]

export default function EnterpriseClientPage() {
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    message: "",
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // 这里应该添加表单提交逻辑
    console.log("Form submitted:", formData)
    // 重置表单
    setFormData({
      name: "",
      company: "",
      email: "",
      phone: "",
      message: "",
    })
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">企业级解决方案</Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">为您的企业提供卓越的签证服务</h1>
          <p className="text-xl text-gray-400 mb-8 max-w-3xl mx-auto">
            无论您是跨国公司还是快速成长的初创企业，我们都能为您提供量身定制的签证解决方案，助力您的全球业务拓展。
          </p>
          <Button className="bg-emerald-500 hover:bg-emerald-600 text-lg px-8 py-6">
            咨询企业方案 <ArrowRight className="ml-2" />
          </Button>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {services.map((service, index) => (
            <Card key={index} className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                {service.icon}
                <CardTitle className="text-xl mt-4">{service.title}</CardTitle>
                <CardDescription className="text-gray-400">{service.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Why Choose Us */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center">为什么选择我们的企业服务</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-xl">专业知识</CardTitle>
                <CardDescription className="text-gray-400">
                  拥有多年处理复杂企业签证申请的经验，熟悉各国最新政策。
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-xl">效率至上</CardTitle>
                <CardDescription className="text-gray-400">
                  优化的流程和先进的技术，大幅减少签证处理时间。
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-xl">全程支持</CardTitle>
                <CardDescription className="text-gray-400">
                  从申请准备到签证获得，提供端到端的全面支持。
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-xl">成本控制</CardTitle>
                <CardDescription className="text-gray-400">
                  透明的定价和灵活的方案，帮助您有效控制签证相关成本。
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* Case Studies */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center">客户成功案例</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {caseStudies.map((study, index) => (
              <Card key={index} className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-xl">{study.company}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400 mb-4">
                    <strong>挑战：</strong>
                    {study.challenge}
                  </p>
                  <p className="text-gray-400 mb-4">
                    <strong>解决方案：</strong>
                    {study.solution}
                  </p>
                  <p className="text-emerald-500">
                    <strong>结果：</strong>
                    {study.result}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center">常见问题</h2>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border-zinc-800">
                <AccordionTrigger className="text-white hover:text-emerald-500">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-gray-400">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Contact Form */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">联系我们</h2>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle>获取定制方案</CardTitle>
              <CardDescription>填写以下表单，我们的企业服务专员将尽快与您联系。</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-1">
                      姓名
                    </label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="bg-zinc-800 border-zinc-700 text-white"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-gray-400 mb-1">
                      公司
                    </label>
                    <Input
                      id="company"
                      name="company"
                      value={formData.company}
                      onChange={handleInputChange}
                      className="bg-zinc-800 border-zinc-700 text-white"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-1">
                      邮箱
                    </label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="bg-zinc-800 border-zinc-700 text-white"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-400 mb-1">
                      电话
                    </label>
                    <Input
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="bg-zinc-800 border-zinc-700 text-white"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-400 mb-1">
                    留言
                  </label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    rows={4}
                    required
                  />
                </div>
                <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600">
                  提交
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
