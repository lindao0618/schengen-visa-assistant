import type { Metadata } from "next"
import { HotelBookingFormLoader } from "./HotelBookingFormLoader"

export const metadata: Metadata = {
  title: "酒店自动预订 | Booking.com",
  description: "自动登录 Booking.com，搜索无需预付款酒店并完成预订，生成预订确认单",
}

export default function HotelBookingPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">酒店自动预订</h1>
        <p className="mt-1 text-sm text-gray-500">
          自动在 Booking.com 登录、搜索城市酒店、筛选无需预付款房型、填写入住人信息并完成预订，最终输出预订确认单。
        </p>
      </div>
      <HotelBookingFormLoader />
    </div>
  )
}
