"use client"

import Link from "next/link"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, ChevronRight } from "lucide-react"

const SCHENGEN_COUNTRIES = [
  { slug: "france", label: "法国", flag: "https://flagcdn.com/w80/fr.png" },
  { slug: "germany", label: "德国", flag: "https://flagcdn.com/w80/de.png" },
  { slug: "italy", label: "意大利", flag: "https://flagcdn.com/w80/it.png" },
  { slug: "spain", label: "西班牙", flag: "https://flagcdn.com/w80/es.png" },
  { slug: "netherlands", label: "荷兰", flag: "https://flagcdn.com/w80/nl.png" },
  { slug: "switzerland", label: "瑞士", flag: "https://flagcdn.com/w80/ch.png" },
  { slug: "austria", label: "奥地利", flag: "https://flagcdn.com/w80/at.png" },
  { slug: "belgium", label: "比利时", flag: "https://flagcdn.com/w80/be.png" },
  { slug: "portugal", label: "葡萄牙", flag: "https://flagcdn.com/w80/pt.png" },
  { slug: "greece", label: "希腊", flag: "https://flagcdn.com/w80/gr.png" },
]

export default function SchengenMaterialsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-b from-gray-900 to-gray-700 dark:from-white dark:to-gray-400">
            申根材料准备
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            选择目标国家，查看并勾选所需材料清单
          </p>
        </div>

        <Card className="backdrop-blur-md bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-black border border-gray-200/50 dark:border-gray-800/50 shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-gray-100 dark:border-gray-800/50">
            <CardTitle className="text-2xl font-semibold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              选择申根国家
            </CardTitle>
            <CardDescription>
              不同国家材料要求略有差异，请选择您要申请签证的国家进入材料清单
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {SCHENGEN_COUNTRIES.map((country) => (
                <Link
                  key={country.slug}
                  href={`/schengen-visa/materials/${country.slug}`}
                  className="flex items-center gap-4 p-4 rounded-xl border border-gray-200/50 dark:border-gray-800/50 bg-white/80 dark:bg-gray-900/50 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg transition-all duration-200 group"
                >
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 shadow-sm">
                    <Image
                      src={country.flag}
                      alt={country.label}
                      width={48}
                      height={48}
                      className="object-cover"
                    />
                  </div>
                  <span className="font-medium text-gray-900 dark:text-gray-100 flex-1">
                    {country.label}
                  </span>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 shrink-0" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
