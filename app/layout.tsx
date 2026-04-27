import type React from "react"
import { Inter } from "next/font/google"
import { NavBar } from "@/components/nav-bar"
import { Providers } from "@/components/providers"
import { LazyToaster } from "@/components/lazy-toaster"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
})

interface RootLayoutProps {
  children: React.ReactNode
}


export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`${inter.className} min-h-screen bg-white text-gray-900 antialiased overflow-x-hidden`}>
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <NavBar />
            <main className="flex-1">
              {children}
            </main>
          </div>
          <LazyToaster richColors closeButton />
        </Providers>
      </body>
    </html>
  )
}

export const metadata = {
  title: "签证助手 - 您的一站式签证申请平台",
  description: "提供美国签证、申根签证等多国签证申请服务和材料审核",
  generator: "v0.dev"
};
