"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { 
  Search, 
  Filter, 
  Eye, 
  CheckCircle, 
  XCircle,
  Clock,
  DollarSign,
  AlertTriangle
} from "lucide-react"

interface Refund {
  id: string
  orderId: string
  userId: string
  userEmail: string
  userName: string
  amount: number
  reason: string
  status: "pending" | "approved" | "rejected" | "completed"
  createdAt: string
  processedAt?: string
  processedBy?: string
  adminNotes?: string
}

export default function RefundsPage() {
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [filteredRefunds, setFilteredRefunds] = useState<Refund[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [adminNotes, setAdminNotes] = useState("")

  useEffect(() => {
    fetchRefunds()
  }, [])

  const fetchRefunds = async () => {
    try {
      // 模拟数据，实际应该从API获取
      const mockRefunds: Refund[] = [
        {
          id: "REF-001",
          orderId: "ORD-001",
          userId: "user-1",
          userEmail: "user1@example.com",
          userName: "张三",
          amount: 299,
          reason: "服务未按预期提供，申请退款",
          status: "pending",
          createdAt: "2024-01-15T10:30:00Z"
        },
        {
          id: "REF-002",
          orderId: "ORD-002",
          userId: "user-2",
          userEmail: "user2@example.com",
          userName: "李四",
          amount: 399,
          reason: "个人原因取消申请",
          status: "approved",
          createdAt: "2024-01-14T15:45:00Z",
          processedAt: "2024-01-15T09:00:00Z",
          processedBy: "admin@example.com",
          adminNotes: "用户主动申请退款，符合退款条件"
        },
        {
          id: "REF-003",
          orderId: "ORD-003",
          userId: "user-3",
          userEmail: "user3@example.com",
          userName: "王五",
          amount: 199,
          reason: "系统故障导致服务中断",
          status: "completed",
          createdAt: "2024-01-13T09:20:00Z",
          processedAt: "2024-01-13T14:30:00Z",
          processedBy: "admin@example.com",
          adminNotes: "确认系统故障，已全额退款"
        },
        {
          id: "REF-004",
          orderId: "ORD-004",
          userId: "user-4",
          userEmail: "user4@example.com",
          userName: "赵六",
          amount: 349,
          reason: "服务已完成，但质量不满意",
          status: "rejected",
          createdAt: "2024-01-12T14:15:00Z",
          processedAt: "2024-01-13T10:00:00Z",
          processedBy: "admin@example.com",
          adminNotes: "服务已按标准完成，不符合退款条件"
        },
        {
          id: "REF-005",
          orderId: "ORD-005",
          userId: "user-5",
          userEmail: "user5@example.com",
          userName: "钱七",
          amount: 279,
          reason: "重复支付，申请退款",
          status: "pending",
          createdAt: "2024-01-11T11:30:00Z"
        }
      ]
      
      setRefunds(mockRefunds)
    } catch (error) {
      console.error("获取退款列表失败:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterRefunds = useCallback(() => {
    let filtered = refunds

    // 搜索过滤
    if (searchTerm) {
      filtered = filtered.filter(refund => 
        refund.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        refund.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        refund.orderId.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // 状态过滤
    if (statusFilter !== "all") {
      filtered = filtered.filter(refund => refund.status === statusFilter)
    }

    setFilteredRefunds(filtered)
  }, [refunds, searchTerm, statusFilter])

  useEffect(() => {
    filterRefunds()
  }, [filterRefunds])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">待处理</Badge>
      case "approved":
        return <Badge variant="outline" className="text-green-600">已批准</Badge>
      case "rejected":
        return <Badge variant="destructive">已拒绝</Badge>
      case "completed":
        return <Badge variant="outline" className="text-blue-600">已完成</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const handleProcessRefund = async (refundId: string, action: "approve" | "reject") => {
    try {
      // 实际应该调用API处理退款
      console.log(`处理退款 ${refundId}，操作: ${action}`)
      
      const newStatus = action === "approve" ? "approved" : "rejected"
      
      // 更新本地状态
      setRefunds(refunds.map(refund => 
        refund.id === refundId 
          ? { 
              ...refund, 
              status: newStatus as any,
              processedAt: new Date().toISOString(),
              processedBy: "admin@example.com",
              adminNotes: adminNotes
            } 
          : refund
      ))
      
      setIsDialogOpen(false)
      setSelectedRefund(null)
      setAdminNotes("")
    } catch (error) {
      console.error("处理退款失败:", error)
    }
  }

  const openProcessDialog = (refund: Refund) => {
    setSelectedRefund(refund)
    setIsDialogOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">退款管理</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            处理用户退款申请，审核退款请求
          </p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待处理退款</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{refunds.filter(r => r.status === "pending").length}</div>
            <p className="text-xs text-muted-foreground">
              需要及时处理
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已批准退款</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{refunds.filter(r => r.status === "approved").length}</div>
            <p className="text-xs text-muted-foreground">
              等待处理完成
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已拒绝退款</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{refunds.filter(r => r.status === "rejected").length}</div>
            <p className="text-xs text-muted-foreground">
              不符合退款条件
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">退款总额</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ¥{refunds.filter(r => r.status === "completed").reduce((sum, r) => sum + r.amount, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              已完成的退款
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和过滤 */}
      <Card>
        <CardHeader>
          <CardTitle>搜索和过滤</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜索用户名、邮箱或订单号..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有状态</SelectItem>
                <SelectItem value="pending">待处理</SelectItem>
                <SelectItem value="approved">已批准</SelectItem>
                <SelectItem value="rejected">已拒绝</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => {
              setSearchTerm("")
              setStatusFilter("all")
            }}>
              <Filter className="mr-2 h-4 w-4" />
              重置过滤
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 退款列表 */}
      <Card>
        <CardHeader>
          <CardTitle>退款申请列表</CardTitle>
          <CardDescription>
            共 {filteredRefunds.length} 个退款申请
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>退款信息</TableHead>
                <TableHead>用户信息</TableHead>
                <TableHead>退款金额</TableHead>
                <TableHead>申请原因</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>申请时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRefunds.map((refund) => (
                <TableRow key={refund.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{refund.id}</div>
                      <div className="text-sm text-gray-500">订单: {refund.orderId}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{refund.userName}</div>
                      <div className="text-sm text-gray-500">{refund.userEmail}</div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">¥{refund.amount}</TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate" title={refund.reason}>
                      {refund.reason}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(refund.status)}</TableCell>
                  <TableCell>{formatDate(refund.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => openProcessDialog(refund)}
                        disabled={refund.status !== "pending"}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {refund.status === "pending" && (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleProcessRefund(refund.id, "approve")}
                            className="text-green-600"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleProcessRefund(refund.id, "reject")}
                            className="text-red-600"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 处理退款对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>处理退款申请</DialogTitle>
            <DialogDescription>
              审核退款申请并添加处理意见
            </DialogDescription>
          </DialogHeader>
          {selectedRefund && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">退款编号</label>
                  <p className="text-sm text-gray-600">{selectedRefund.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">订单编号</label>
                  <p className="text-sm text-gray-600">{selectedRefund.orderId}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">申请用户</label>
                  <p className="text-sm text-gray-600">{selectedRefund.userName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">退款金额</label>
                  <p className="text-sm text-gray-600">¥{selectedRefund.amount}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">申请原因</label>
                <p className="text-sm text-gray-600 mt-1">{selectedRefund.reason}</p>
              </div>
              <div>
                <label className="text-sm font-medium">处理意见</label>
                <Textarea
                  placeholder="请输入处理意见..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
            >
              取消
            </Button>
            <Button 
              onClick={() => selectedRefund && handleProcessRefund(selectedRefund.id, "approve")}
              className="bg-green-600 hover:bg-green-700"
            >
              批准退款
            </Button>
            <Button 
              onClick={() => selectedRefund && handleProcessRefund(selectedRefund.id, "reject")}
              variant="destructive"
            >
              拒绝退款
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}










