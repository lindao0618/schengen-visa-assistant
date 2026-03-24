'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Plane, 
  Train, 
  MapPin, 
  Calendar 
} from 'lucide-react';

interface TicketBookingSite {
  name: string;
  nameEn: string;
  url: string;
  description: string;
  features: string[];
  logo?: string;
  color: string;
  region: string;
  type: 'flight' | 'train';
}

const ticketBookingSites: TicketBookingSite[] = [
  {
    name: "欧洲之星",
    nameEn: "Eurostar",
    url: "https://www.eurostar.com",
    description: "连接伦敦与巴黎、布鲁塞尔、阿姆斯特丹等欧洲城市的高铁服务，申根签证申请常用",
    features: ["伦敦直达欧洲", "2小时到巴黎", "无需转机", "市中心出发"],
    color: "#003399",
    region: "英欧跨境",
    type: "train"
  },
  {
    name: "携程",
    nameEn: "Ctrip",
    url: "https://www.ctrip.com",
    description: "中国领先的在线旅行服务公司，提供机票、火车票预订服务",
    features: ["价格透明", "服务保障", "积分奖励", "24小时客服"],
    color: "#1890FF",
    region: "中国优势",
    type: "flight"
  },
  {
    name: "去哪儿",
    nameEn: "Qunar",
    url: "https://www.qunar.com",
    description: "专业的旅游搜索引擎，提供机票和火车票比价服务",
    features: ["比价搜索", "低价保障", "快速出票", "退改保障"],
    color: "#52C41A",
    region: "中国优势",
    type: "flight"
  },
  {
    name: "Expedia",
    nameEn: "Expedia",
    url: "https://www.expedia.com",
    description: "知名国际旅行预订网站，提供机票和酒店套餐优惠",
    features: ["套餐优惠", "积分奖励", "价格保障", "移动应用"],
    color: "#FFC72C",
    region: "全球",
    type: "flight"
  },
  {
    name: "Skyscanner",
    nameEn: "Skyscanner",
    url: "https://www.skyscanner.com",
    description: "全球领先的旅游搜索引擎，比较各大航空公司机票价格",
    features: ["价格比较", "灵活日期", "价格提醒", "最佳时机"],
    color: "#0770E3",
    region: "全球",
    type: "flight"
  },
  {
    name: "飞猪",
    nameEn: "Fliggy",
    url: "https://www.fliggy.com",
    description: "阿里巴巴旗下旅行平台，提供机票预订和旅游服务",
    features: ["阿里生态", "信用住", "花呗分期", "芝麻信用"],
    color: "#FF6A00",
    region: "中国优势",
    type: "flight"
  }
];

export default function TicketBookingPage() {
  const router = useRouter();

  const handleBackToMaterials = () => {
    router.push('/material-customization');
  };

  const handleBookingRedirect = (url: string, siteName: string) => {
    // 在新窗口打开，避免用户丢失当前页面
    window.open(url, '_blank', 'noopener,noreferrer');
    
    // 可以在这里添加统计代码
    console.log(`用户点击了 ${siteName} 预订链接`);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* 返回按钮 */}
      <div className="mb-6">
        <Button
          onClick={handleBackToMaterials}
          variant="outline"
          className="flex items-center gap-2 hover:bg-blue-50 border-blue-500 text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft className="w-4 h-4" />
          返回定制材料
        </Button>
      </div>

      {/* 页面标题 */}
      <div className="text-center mb-8">
        <Plane className="w-12 h-12 text-blue-600 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          🚄 机票/车票预订服务
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          为您推荐优质的机票和车票预订平台，比较价格，找到最优惠的出行选择
        </p>
      </div>

      {/* 使用提示 */}
      <Card className="mb-8 bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
            🚄 预订小贴士
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-700 mb-2">
                • 建议多个平台比价，寻找最优惠价格
              </p>
              <p className="text-sm text-gray-700">
                • 注意查看退改签政策和行李/座位规定
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-700 mb-2">
                • 提前预订通常能获得更好的价格
              </p>
              <p className="text-sm text-gray-700">
                • 火车出行环保便利，机票长途快捷
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 机票/车票预订网站卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {ticketBookingSites.map((site, index) => (
          <Card key={index} className="h-full hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {site.type === 'train' ? (
                    <Train className="w-6 h-6" style={{ color: site.color }} />
                  ) : (
                    <Plane className="w-6 h-6" style={{ color: site.color }} />
                  )}
                  <CardTitle className="text-lg">{site.name}</CardTitle>
                </div>
                <Badge 
                  variant="secondary" 
                  className="text-xs font-medium"
                  style={{ 
                    backgroundColor: `${site.color}20`,
                    color: site.color 
                  }}
                >
                  {site.region}
                </Badge>
              </div>
              <p className="text-sm text-gray-500">{site.nameEn}</p>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col">
              <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                {site.description}
              </p>
              
              <div className="mt-auto">
                <p className="text-sm font-medium text-gray-800 mb-3">
                  ⭐ 主要特色：
                </p>
                <div className="flex flex-wrap gap-2">
                  {site.features.map((feature, idx) => (
                    <Badge 
                      key={idx}
                      variant="outline"
                      className="text-xs"
                      style={{ 
                        borderColor: site.color,
                        color: site.color 
                      }}
                    >
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <Button
                onClick={() => handleBookingRedirect(site.url, site.name)}
                className="w-full mt-6 font-medium"
                style={{ backgroundColor: site.color }}
              >
                <div className="flex items-center gap-2">
                  {site.type === 'train' ? (
                    <Train className="w-4 h-4" />
                  ) : (
                    <Plane className="w-4 h-4" />
                  )}
                  立即前往预订
                </div>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 其他相关服务 */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">
          🔗 其他旅行服务
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <Card className="text-center p-6">
            <MapPin className="w-10 h-10 text-blue-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-2">酒店预订</h3>
            <p className="text-sm text-gray-600">
              已开放酒店预订服务
            </p>
          </Card>
          <Card className="text-center p-6">
            <Calendar className="w-10 h-10 text-amber-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-2">行程规划</h3>
            <p className="text-sm text-gray-600">
              即将推出智能行程规划服务
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}