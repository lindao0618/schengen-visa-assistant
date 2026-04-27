"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function DebugBookingClientPage() {
  const [bookingHistory, setBookingHistory] = useState<any[]>([])
  const [currentBooking, setCurrentBooking] = useState<any>(null)

  useEffect(() => {
    // 加载预约历史
    const history = JSON.parse(localStorage.getItem('bookingHistory') || '[]')
    setBookingHistory(history)
    if (history.length > 0) {
      setCurrentBooking(history[0])
    }
  }, [])

  const clearHistory = () => {
    localStorage.removeItem('bookingHistory')
    setBookingHistory([])
    setCurrentBooking(null)
  }

  const refreshData = () => {
    const history = JSON.parse(localStorage.getItem('bookingHistory') || '[]')
    setBookingHistory(history)
    if (history.length > 0) {
      setCurrentBooking(history[0])
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>预约数据调试</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={refreshData} className="bg-blue-600 hover:bg-blue-700">
              刷新数据
            </Button>
            <Button onClick={clearHistory} variant="outline">
              清除历史
            </Button>
          </div>

          <div>
            <h3 className="font-semibold mb-2">预约历史数量: {bookingHistory.length}</h3>
          </div>

          {currentBooking && (
            <div className="space-y-4">
              <h3 className="font-semibold">最新预约数据:</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">基本信息</h4>
                  <div className="text-sm space-y-1">
                    <div><strong>ID:</strong> {currentBooking.id}</div>
                    <div><strong>状态:</strong> {currentBooking.status}</div>
                    <div><strong>提交时间:</strong> {currentBooking.submittedAt}</div>
                    <div><strong>处理时间:</strong> {currentBooking.processedAt || '未处理'}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">TLS账号信息</h4>
                  <div className="text-sm space-y-1">
                    <div><strong>用户名:</strong> {currentBooking.tlsAccount?.username}</div>
                    <div><strong>密码:</strong> {currentBooking.tlsAccount?.password ? '***' : '未设置'}</div>
                    <div><strong>国家:</strong> {currentBooking.tlsAccount?.country}</div>
                    <div><strong>城市:</strong> {currentBooking.tlsAccount?.city}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">预约参数</h4>
                  <div className="text-sm space-y-1">
                    <div><strong>Slot类型:</strong> {currentBooking.bookingParams?.slotTypes?.join(', ')}</div>
                    <div><strong>时间范围数量:</strong> {currentBooking.bookingParams?.dateTimeRanges?.length || 0}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">支付信息</h4>
                  <div className="text-sm space-y-1">
                    <div><strong>人数:</strong> {currentBooking.payment?.peopleCount}</div>
                    <div><strong>总金额:</strong> {currentBooking.payment?.totalAmount}</div>
                    <div><strong>支付方式:</strong> {currentBooking.payment?.paymentMethod}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">时间范围详情</h4>
                {currentBooking.bookingParams?.dateTimeRanges?.map((range: any, index: number) => (
                  <div key={index} className="text-sm p-2 bg-gray-50 rounded">
                    <div><strong>范围 {index + 1}:</strong></div>
                    <div>开始日期: {range.startDate}</div>
                    <div>结束日期: {range.endDate}</div>
                    <div>开始时间: {range.startTime}</div>
                    <div>结束时间: {range.endTime}</div>
                  </div>
                ))}
              </div>

              {currentBooking.result && (
                <div className="space-y-2">
                  <h4 className="font-medium">处理结果</h4>
                  <pre className="text-sm bg-gray-50 p-2 rounded overflow-auto">
                    {JSON.stringify(currentBooking.result, null, 2)}
                  </pre>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="font-medium">完整数据 (JSON)</h4>
                <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-96">
                  {JSON.stringify(currentBooking, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {bookingHistory.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              暂无预约数据
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}




























