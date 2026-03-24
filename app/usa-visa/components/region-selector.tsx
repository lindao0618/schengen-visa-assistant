import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Globe } from "lucide-react"

interface RegionSelectorProps {
  onSelect: (country: string, system: string) => void
}

// 签证系统映射
const visaSystemMap: { [key: string]: string } = {
  "中国": "CGI",
  "香港": "CGI",
  "台湾": "CGI",
  "日本": "CGI",
  "韩国": "CGI",
  "新加坡": "CGI",
  "马来西亚": "CGI",
  "英国": "AIS",
  "法国": "AIS",
  "德国": "AIS",
  "意大利": "AIS",
  "西班牙": "AIS",
  "加拿大": "AIS",
  "墨西哥": "AIS",
}

// 地区数据
const regions = {
  americas: {
    name: "美洲",
    countries: ["加拿大", "墨西哥"]
  },
  europe: {
    name: "欧洲",
    countries: ["英国", "法国", "德国", "意大利", "西班牙"]
  },
  asia: {
    name: "亚洲",
    countries: ["中国", "香港", "台湾", "日本", "韩国", "新加坡", "马来西亚"]
  },
  oceania: {
    name: "大洋洲",
    countries: []
  }
}

export function RegionSelector({ onSelect }: RegionSelectorProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold flex items-center gap-2">
        <Globe className="h-5 w-5 text-blue-500" />
        选择国家/地区
      </h3>

      <Tabs defaultValue="asia" className="w-full">
        <TabsList className="grid grid-cols-4">
          <TabsTrigger value="americas">{regions.americas.name}</TabsTrigger>
          <TabsTrigger value="europe">{regions.europe.name}</TabsTrigger>
          <TabsTrigger value="asia">{regions.asia.name}</TabsTrigger>
          <TabsTrigger value="oceania">{regions.oceania.name}</TabsTrigger>
        </TabsList>

        {Object.entries(regions).map(([key, region]) => (
          <TabsContent key={key} value={key} className="mt-4">
            <div className="space-y-4">
              <Select 
                onValueChange={(country) => {
                  const system = visaSystemMap[country] || "Unknown"
                  onSelect(country, system)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择国家/地区" />
                </SelectTrigger>
                <SelectContent>
                  {region.countries.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country} ({visaSystemMap[country]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
