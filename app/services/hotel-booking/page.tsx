'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Hotel,
  Star,
  Globe,
  Plane,
  Map,
  ArrowLeft,
  ExternalLink
} from "lucide-react";

interface HotelBookingSite {
  name: string;
  nameEn: string;
  url: string;
  description: string;
  features: string[];
  logo?: string;
  color: string;
  region: string;
}

const hotelBookingSites: HotelBookingSite[] = [
  {
    name: "Booking.com",
    nameEn: "Booking.com",
    url: "https://www.booking.com",
    description: "全球最大的酒店预订平台，覆盖230多个国家和地区",
    features: ["免费取消", "最低价保证", "真实用户评价", "24/7客服"],
    color: "#003580",
    region: "全球"
  },
  {
    name: "携程",
    nameEn: "Trip.com",
    url: "https://www.trip.com",
    description: "中国领先的在线旅行服务公司，提供全球酒店预订服务",
    features: ["中文客服", "银联支付", "积分返现", "会员专享价"],
    color: "#1890ff",
    region: "全球"
  },
  {
    name: "Agoda",
    nameEn: "Agoda",
    url: "https://www.agoda.com",
    description: "亚洲领先的在线酒店预订平台，亚洲酒店资源丰富",
    features: ["亚洲优势", "会员折扣", "快速预订", "价格匹配"],
    color: "#ff6b35",
    region: "亚洲优势"
  },
  {
    name: "Expedia",
    nameEn: "Expedia",
    url: "https://www.expedia.com",
    description: "知名国际旅行预订网站，提供酒店+机票套餐优惠",
    features: ["套餐优惠", "积分奖励", "价格预警", "移动应用"],
    color: "#ffd200",
    region: "全球"
  },
  {
    name: "Hotels.com",
    nameEn: "Hotels.com",
    url: "https://www.hotels.com",
    description: "专业酒店预订平台，住10晚送1晚免费",
    features: ["住10送1", "秘密价格", "24小时客服", "价格保证"],
    color: "#d32f2f",
    region: "全球"
  },
  {
    name: "去哪儿",
    nameEn: "Qunar",
    url: "https://www.qunar.com",
    description: "中国知名旅行搜索引擎，比价功能强大",
    features: ["价格比较", "特价酒店", "闪住服务", "保险保障"],
    color: "#00a0e9",
    region: "中国优势"
  },
  {
    name: "飞猪",
    nameEn: "Fliggy",
    url: "https://www.fliggy.com",
    description: "阿里巴巴旗下综合性旅游服务平台",
    features: ["支付宝支付", "信用住", "超级会员", "旅行保障"],
    color: "#ff6900",
    region: "中国优势"
  },
  {
    name: "Airbnb",
    nameEn: "Airbnb",
    url: "https://www.airbnb.com",
    description: "全球民宿短租平台，体验当地生活",
    features: ["民宿特色", "当地体验", "长住优惠", "房东沟通"],
    color: "#ff5a5f",
    region: "全球"
  }
];

export default function HotelBookingPage() {
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
    <div className="container mx-auto py-10 px-4 bg-gradient-to-br from-gray-100 to-gray-300 dark:from-neutral-950 dark:to-neutral-800 min-h-screen">
      {/* 返回按钮 */}
      <div className="mb-6">
        <Button
          onClick={handleBackToMaterials}
          variant="outline"
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          返回定制材料
        </Button>
      </div>

      {/* 页面标题 */}
      <header className="mb-12 text-center">
        <Hotel className="h-12 w-12 mx-auto mb-4 text-neutral-700 dark:text-neutral-300" />
        <h1 className="text-4xl font-bold tracking-tight text-black dark:text-white sm:text-5xl">
          酒店预订服务
        </h1>
        <p className="mt-4 text-xl text-neutral-700 dark:text-neutral-300 max-w-2xl mx-auto">
          为您推荐优质的酒店预订平台，比较价格，找到最适合的住宿选择
        </p>
      </header>

      {/* 使用提示 */}
      <Card className="mb-8 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-blue-800 dark:text-blue-200">💡 预订小贴士</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">• 建议多个平台比价，寻找最优惠价格</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">• 注意查看取消政策和入住条款</p>
            </div>
            <div>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">• 阅读真实用户评价和酒店位置信息</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">• 考虑预订套餐（酒店+机票）可能更优惠</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 酒店预订网站卡片 */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 mb-12">
        {hotelBookingSites.map((site, index) => (
          <Card key={index} className="flex flex-col overflow-hidden rounded-xl shadow-lg transition-all hover:shadow-2xl bg-white/60 dark:bg-neutral-800/60 backdrop-blur-lg border border-gray-200/70 dark:border-neutral-700/70">
            <CardHeader className="flex flex-row items-center space-x-4 p-6 bg-black/5 dark:bg-white/5 border-b border-gray-200/50 dark:border-neutral-700/50">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: site.color }}
              />
              <div className="flex-1">
                <CardTitle className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">{site.name}</CardTitle>
              </div>
              <Badge variant={site.region.includes('全球') ? 'default' : 'secondary'}>
                {site.region}
              </Badge>
            </CardHeader>
            <CardContent className="flex-grow p-6 flex flex-col">
              <CardDescription className="text-neutral-600 dark:text-neutral-400 mb-4 min-h-[60px] line-clamp-3">
                {site.description}
              </CardDescription>
              
              <div className="mt-auto">
                <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">✨ 主要特色：</h4>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-hidden">
                  {site.features.map((feature, featureIndex) => (
                    <Badge key={featureIndex} variant="outline" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <Button 
                className="w-full mt-4 group" 
                style={{ backgroundColor: site.color }}
                onClick={() => handleBookingRedirect(site.url, site.name)}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                立即前往预订
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 其他相关服务 */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-center mb-6 text-neutral-800 dark:text-neutral-200">
          🔗 其他旅行服务
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="text-center p-6">
            <Plane className="h-10 w-10 mx-auto mb-3 text-neutral-600 dark:text-neutral-400" />
            <h3 className="text-lg font-semibold mb-2 text-neutral-800 dark:text-neutral-200">机票预订</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              即将推出机票比价和预订服务
            </p>
          </Card>
          <Card className="text-center p-6">
            <Map className="h-10 w-10 mx-auto mb-3 text-neutral-600 dark:text-neutral-400" />
            <h3 className="text-lg font-semibold mb-2 text-neutral-800 dark:text-neutral-200">旅游攻略</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              目的地攻略和旅行规划建议
            </p>
          </Card>
          <Card className="text-center p-6">
            <Star className="h-10 w-10 mx-auto mb-3 text-neutral-600 dark:text-neutral-400" />
            <h3 className="text-lg font-semibold mb-2 text-neutral-800 dark:text-neutral-200">签证服务</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              专业的签证申请和咨询服务
            </p>
          </Card>
        </div>
      </div>

      {/* 免责声明 */}
      <Card className="bg-gray-50 dark:bg-neutral-800/50 border-gray-200 dark:border-neutral-700">
        <CardContent className="p-4">
          <p className="text-xs text-center text-neutral-600 dark:text-neutral-400">
            ⚠️ 免责声明：本页面仅提供酒店预订网站导航服务，具体预订条款和价格以各预订平台为准。
            请在预订前仔细阅读相关条款和政策。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}