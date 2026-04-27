export type VisaSystemType = "AIS" | "AVITS" | "CGI" | "Unknown"

export interface BookingFormData {
  country: string
  location: string
  systemType: VisaSystemType
  timeRanges: {
    startDate: Date
    endDate: Date
  }[]
  notificationMethod: "email" | "phone" | "both"
  email: string
  phone: string
  accountCredentials: {
    username: string
    password: string
    securityAnswers?: Record<string, string>
    applicationId?: string
    passportNumber?: string
    additionalInfo?: Record<string, string>
  }
  payment: {
    baseFee: number
    extraPersonFee: number
    expediteFee: number
    totalFee: number
    paymentMethod: "wechat" | "alipay" | "creditCard"
  }
  numberOfApplicants: number
  expediteService: boolean
}
