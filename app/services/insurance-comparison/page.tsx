'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Shield, 
  Star, 
  Globe, 
  Plane, 
  Building2, 
  MapPin 
} from 'lucide-react';

interface InsuranceSite {
  name: string;
  nameEn: string;
  url: string;
  description: string;
  features: string[];
  logo?: string;
  color: string;
  region: string;
  type: 'comprehensive' | 'budget' | 'premium';
}

const insuranceSites: InsuranceSite[] = [
  {
    name: "Coverwise",
    nameEn: "Coverwise",
    url: "https://www.coverwise.co.uk",
    description: "英国领先的旅游保险比价平台，专业服务申根签证保险需求",
    features: ["申根签证认证", "医疗保障全面", "24小时紧急救援", "在线理赔"],
    color: "#1976D2",
    region: "英国/欧洲",
    type: "comprehensive"
  },
  {
    name: "安联保险",
    nameEn: "Allianz Travel",
    url: "https://www.allianz-travel.com",
    description: "全球知名保险公司，提供专业的旅游保险服务",
    features: ["全球理赔", "医疗费用高", "紧急救援", "行李保障"],
    color: "#0033A0",
    region: "全球",
    type: "premium"
  },
  {
    name: "中国人保",
    nameEn: "PICC Travel Insurance",
    url: "https://www.epicc.com.cn",
    description: "中国领先的保险公司，提供境外旅游保险服务",
    features: ["中文服务", "申根认证", "快速理赔", "价格优惠"],
    color: "#E53935",
    region: "中国",
    type: "comprehensive"
  },
  {
    name: "World Nomads",
    nameEn: "World Nomads",
    url: "https://www.worldnomads.com",
    description: "专为背包客和冒险旅行者设计的灵活保险方案",
    features: ["灵活保障", "极限运动", "在线购买", "全球覆盖"],
    color: "#FF6B35",
    region: "全球",
    type: "comprehensive"
  },
  {
    name: "太平洋保险",
    nameEn: "CPIC Travel",
    url: "https://www.cpic.com.cn",
    description: "中国太平洋保险集团旅游保险产品，性价比高",
    features: ["境外医疗", "意外保障", "财产保险", "便民理赔"],
    color: "#4CAF50",
    region: "中国",
    type: "budget"
  },
  {
    name: "AXA Travel",
    nameEn: "AXA Travel Insurance",
    url: "https://www.axa-travel-insurance.co.uk",
    description: "法国安盛集团旅游保险，欧洲旅行首选",
    features: ["欧洲专业", "医疗无上限", "多语言服务", "快速审核"],
    color: "#8E24AA",
    region: "欧洲",
    type: "premium"
  }
];

export default function InsuranceComparisonPage() {
  const router = useRouter();

  const handleBackToMaterials = () => {
    router.push('/material-customization');
  };

  const handleInsuranceRedirect = (url: string, siteName: string) => {
    // 在新窗口打开，避免用户丢失当前页面
    window.open(url, '_blank', 'noopener,noreferrer');
    
    // 可以在这里添加统计代码
    console.log(`用户点击了 ${siteName} 保险链接`);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'premium':
        return <Star className="w-4 h-4" />;
      case 'budget':
        return <Plane className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'premium':
        return '高端保障';
      case 'budget':
        return '经济实惠';
      default:
        return '全面保障';
    }
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
        <Shield className="w-12 h-12 text-blue-600 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          🛡️ 旅游保险比较服务
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          为您推荐优质的旅游保险产品，申根签证保险一站式解决方案
        </p>
      </div>

      {/* 使用提示 */}
      <Card className="mb-8 bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
            🛡️ 保险选择小贴士
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-700 mb-2">
                • 申根签证要求医疗保险最低3万欧元保障
              </p>
              <p className="text-sm text-gray-700">
                • 确保保险覆盖整个申根区域和旅行期间
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-700 mb-2">
                • 建议选择包含紧急医疗救援的保险产品
              </p>
              <p className="text-sm text-gray-700">
                • 注意查看保险条款中的免赔额和理赔流程
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 保险网站卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {insuranceSites.map((site, index) => (
          <Card key={index} className="h-full hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getTypeIcon(site.type)}
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
                  {getTypeLabel(site.type)}
                </Badge>
              </div>
              <p className="text-sm text-gray-500">{site.nameEn}</p>
              <div className="flex items-center gap-1 mt-2">
                <Globe className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500">服务区域：{site.region}</span>
              </div>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col">
              <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                {site.description}
              </p>
              
              <div className="mt-auto">
                <p className="text-sm font-medium text-gray-800 mb-3">
                  🔥 保障特色：
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
                onClick={() => handleInsuranceRedirect(site.url, site.name)}
                className="w-full mt-6 font-medium"
                style={{ backgroundColor: site.color }}
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  立即了解保险
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
            <Building2 className="w-10 h-10 text-blue-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-2">酒店预订</h3>
            <p className="text-sm text-gray-600">
              已开放酒店预订服务
            </p>
          </Card>
          <Card className="text-center p-6">
            <Plane className="w-10 h-10 text-amber-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-2">机票预订</h3>
            <p className="text-sm text-gray-600">
              已开放机票预订服务
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}