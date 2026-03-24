"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  FileText, 
  Search, 
  Filter, 
  ArrowUpDown, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  XCircle 
} from "lucide-react"

// 模拟订单数据
const mockOrders = [
  {
    id: "ORD-2023-1001",
    customer: "张三",
    email: "zhang.san@example.com",
    amount: 1299,
    status: "completed",
    date: "2023-10-15",
    visaType: "申根签证",
    country: "法国"
  },
  {
    id: "ORD-2023-1002",
    customer: "李四",
    email: "li.si@example.com",
    amount: 1499,
    status: "processing",
    date: "2023-10-16",
    visaType: "申根签证",
    country: "德国"
  },
  {
    id: "ORD-2023-1003",
    customer: "王五",
    email: "wang.wu@example.com",
    amount: 2299,
    status: "pending",
    date: "2023-10-17",
    visaType: "美国签证",
    country: "美国"
  },
  {
    id: "ORD-2023-1004",
    customer: "赵六",
    email: "zhao.liu@example.com",
    amount: 1899,
    status: "cancelled",
    date: "2023-10-14",
    visaType: "英国签证",
    country: "英国"
  },
  {
    id: "ORD-2023-1005",
    customer: "钱七",
    email: "qian.qi@example.com",
    amount: 1699,
    status: "completed",
    date: "2023-10-13",
    visaType: "申根签证",
    country: "意大利"
  }
]

// 状态标签组件
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          已完成
        </Badge>
      )
    case "processing":
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          处理中
        </Badge>
      )
    case "pending":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          待处理
        </Badge>
      )
    case "cancelled":
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          已取消
        </Badge>
      )
    default:
      return <Badge>{status}</Badge>
  }
}

export default function OrdersPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filteredOrders, setFilteredOrders] = useState(mockOrders)

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchTerm(value)
    
    if (!value) {
      setFilteredOrders(mockOrders)
      return
    }
    
    const filtered = mockOrders.filter(order => 
      order.id.toLowerCase().includes(value.toLowerCase()) ||
      order.customer.toLowerCase().includes(value.toLowerCase()) ||
      order.email.toLowerCase().includes(value.toLowerCase()) ||
      order.visaType.toLowerCase().includes(value.toLowerCase()) ||
      order.country.toLowerCase().includes(value.toLowerCase())
    )
    
    setFilteredOrders(filtered)
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">订单管理</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            查看和管理所有签证申请订单
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            筛选
          </Button>
          <Button>
            <FileText className="h-4 w-4 mr-2" />
            导出
          </Button>
        </div>
      </div>

      {/* 搜索栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pl-10"
              placeholder="搜索订单编号、客户名称、邮箱或签证类型..."
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
        </CardContent>
      </Card>

      {/* 订单表格 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            订单列表
          </CardTitle>
          <CardDescription>
            共 {filteredOrders.length} 个订单
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <div className="flex items-center gap-1">
                      订单编号
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <div className="flex items-center gap-1">
                      客户
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left">签证类型</th>
                  <th className="px-4 py-3 text-left">国家</th>
                  <th className="px-4 py-3 text-left">
                    <div className="flex items-center gap-1">
                      金额
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <div className="flex items-center gap-1">
                      日期
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left">状态</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 font-medium">{order.id}</td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium">{order.customer}</div>
                        <div className="text-xs text-gray-500">{order.email}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{order.visaType}</td>
                    <td className="px-4 py-3">{order.country}</td>
                    <td className="px-4 py-3">¥{order.amount.toLocaleString()}</td>
                    <td className="px-4 py-3">{order.date}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm">
                        查看
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}