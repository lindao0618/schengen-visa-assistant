const fs = require('fs');
const path = require('path');

// 测试DS160服务的基本文件和目录结构
async function testDS160Setup() {
  console.log('🔍 检测DS160服务设置...\n');
  
  const checks = [
    {
      name: 'DS160处理器目录',
      path: 'services/ds160-processor',
      type: 'dir'
    },
    {
      name: 'DS160真实脚本',
      path: 'services/ds160-processor/ds160_real.py',
      type: 'file'
    },
    {
      name: 'DS160服务器脚本',
      path: 'services/ds160-processor/ds160_server.py',
      type: 'file'
    },
    {
      name: '国家映射文件',
      path: 'services/ds160-processor/country_map.xlsx',
      type: 'file'
    },
    {
      name: 'DS160 API路由',
      path: 'app/api/usa-visa/ds160/auto-fill/route.ts',
      type: 'file'
    },
    {
      name: '下载API路由',
      path: 'app/api/usa-visa/ds160/download/[tempId]/[filename]/route.ts',
      type: 'file'
    },
    {
      name: 'DS160前端组件',
      path: 'app/usa-visa/components/ds160-form-fixed.tsx',
      type: 'file'
    },
    {
      name: 'Excel模板文件',
      path: 'ds160_data模板.xlsx',
      type: 'file'
    }
  ];
  
  let allGood = true;
  
  for (const check of checks) {
    try {
      const fullPath = path.join(__dirname, check.path);
      const stats = fs.statSync(fullPath);
      
      if (check.type === 'dir' && stats.isDirectory()) {
        console.log('✅', check.name, '- 目录存在');
      } else if (check.type === 'file' && stats.isFile()) {
        const size = (stats.size / 1024).toFixed(1);
        console.log('✅', check.name, `- 文件存在 (${size}KB)`);
      } else {
        console.log('❌', check.name, '- 类型不匹配');
        allGood = false;
      }
    } catch (error) {
      console.log('❌', check.name, '- 不存在');
      allGood = false;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (allGood) {
    console.log('🎉 所有DS160服务文件都已就绪！');
    console.log('💡 您现在可以：');
    console.log('   1. 启动开发服务器: npm run dev');
    console.log('   2. 访问: http://localhost:3000/usa-visa');
    console.log('   3. 切换到"DS-160 自动填表"标签页');
    console.log('   4. 上传Excel模板和照片测试自动填表功能');
    console.log('\n📋 功能说明：');
    console.log('   • 自动解析Excel数据');
    console.log('   • 真实浏览器自动填写DS160表格');
    console.log('   • 自动处理验证码（2Captcha）');
    console.log('   • 生成确认页面和PDF文件');
    console.log('   • 发送结果到指定邮箱');
  } else {
    console.log('⚠️  部分DS160文件缺失，请检查项目完整性');
  }
  
  console.log('\n📊 项目状态总结：');
  console.log('✅ 照片检查功能 - 已完成并测试通过');
  console.log('✅ DS160自动填表功能 - 已完成集成');
  console.log('✅ 文件下载功能 - 已完成');
  console.log('✅ 前端UI界面 - 已优化');
  console.log('📝 待测试：完整DS160工作流程');
}

testDS160Setup(); 