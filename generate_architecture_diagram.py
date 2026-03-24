import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch, ConnectionPatch
import numpy as np

# 设置中文字体
plt.rcParams['font.sans-serif'] = ['SimHei', 'Arial Unicode MS', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

# 创建图形
fig, ax = plt.subplots(1, 1, figsize=(16, 12))
ax.set_xlim(0, 10)
ax.set_ylim(0, 12)
ax.axis('off')

# 定义颜色
colors = {
    'user': '#4A90E2',
    'load_balancer': '#F5A623',
    'web_server': '#7ED321',
    'app_server': '#BD10E0',
    'database': '#50E3C2',
    'cache': '#FF6B6B',
    'storage': '#4ECDC4',
    'ai_service': '#FFA500',
    'support': '#9B59B6'
}

# 绘制用户请求
user_box = FancyBboxPatch((0.5, 10.5), 2, 0.8, 
                          boxstyle="round,pad=0.1", 
                          facecolor=colors['user'], 
                          edgecolor='black', 
                          linewidth=2)
ax.add_patch(user_box)
ax.text(1.5, 10.9, '用户请求', ha='center', va='center', fontsize=12, fontweight='bold', color='white')

# 绘制负载均衡器
lb_box = FancyBboxPatch((3.5, 10.5), 3, 0.8, 
                        boxstyle="round,pad=0.1", 
                        facecolor=colors['load_balancer'], 
                        edgecolor='black', 
                        linewidth=2)
ax.add_patch(lb_box)
ax.text(5, 10.9, '负载均衡器', ha='center', va='center', fontsize=12, fontweight='bold', color='white')

# 绘制Web服务器集群
web_box = FancyBboxPatch((7.5, 10.5), 2, 0.8, 
                         boxstyle="round,pad=0.1", 
                         facecolor=colors['web_server'], 
                         edgecolor='black', 
                         linewidth=2)
ax.add_patch(web_box)
ax.text(8.5, 10.9, 'Web服务器集群', ha='center', va='center', fontsize=12, fontweight='bold', color='white')

# 绘制应用服务器
app_box = FancyBboxPatch((3.5, 8.5), 3, 0.8, 
                         boxstyle="round,pad=0.1", 
                         facecolor=colors['app_server'], 
                         edgecolor='black', 
                         linewidth=2)
ax.add_patch(app_box)
ax.text(5, 8.9, '应用服务器', ha='center', va='center', fontsize=12, fontweight='bold', color='white')

# 绘制数据库集群
db_box = FancyBboxPatch((0.5, 6.5), 2, 0.8, 
                        boxstyle="round,pad=0.1", 
                        facecolor=colors['database'], 
                        edgecolor='black', 
                        linewidth=2)
ax.add_patch(db_box)
ax.text(1.5, 6.9, '数据库集群', ha='center', va='center', fontsize=12, fontweight='bold', color='white')

# 绘制Redis缓存
cache_box = FancyBboxPatch((3.5, 6.5), 2, 0.8, 
                           boxstyle="round,pad=0.1", 
                           facecolor=colors['cache'], 
                           edgecolor='black', 
                           linewidth=2)
ax.add_patch(cache_box)
ax.text(4.5, 6.9, 'Redis缓存', ha='center', va='center', fontsize=12, fontweight='bold', color='white')

# 绘制文件存储
storage_box = FancyBboxPatch((6.5, 6.5), 2, 0.8, 
                             boxstyle="round,pad=0.1", 
                             facecolor=colors['storage'], 
                             edgecolor='black', 
                             linewidth=2)
ax.add_patch(storage_box)
ax.text(7.5, 6.9, '文件存储', ha='center', va='center', fontsize=12, fontweight='bold', color='white')

# 绘制AI服务集群
ai_box = FancyBboxPatch((0.5, 4.5), 2, 0.8, 
                        boxstyle="round,pad=0.1", 
                        facecolor=colors['ai_service'], 
                        edgecolor='black', 
                        linewidth=2)
ax.add_patch(ai_box)
ax.text(1.5, 4.9, 'AI服务集群', ha='center', va='center', fontsize=12, fontweight='bold', color='white')

# 绘制图像处理集群
img_box = FancyBboxPatch((3.5, 4.5), 2, 0.8, 
                         boxstyle="round,pad=0.1", 
                         facecolor=colors['ai_service'], 
                         edgecolor='black', 
                         linewidth=2)
ax.add_patch(img_box)
ax.text(4.5, 4.9, '图像处理集群', ha='center', va='center', fontsize=12, fontweight='bold', color='white')

# 绘制支持系统标题
ax.text(6.5, 4.9, '支持系统', ha='center', va='center', fontsize=14, fontweight='bold', color='black')

# 绘制CDN加速
cdn_box = FancyBboxPatch((6.5, 3.5), 1.5, 0.6, 
                         boxstyle="round,pad=0.05", 
                         facecolor=colors['support'], 
                         edgecolor='black', 
                         linewidth=1)
ax.add_patch(cdn_box)
ax.text(7.25, 3.8, 'CDN加速', ha='center', va='center', fontsize=10, fontweight='bold', color='white')

# 绘制监控系统
monitor_box = FancyBboxPatch((6.5, 2.5), 1.5, 0.6, 
                             boxstyle="round,pad=0.05", 
                             facecolor=colors['support'], 
                             edgecolor='black', 
                             linewidth=1)
ax.add_patch(monitor_box)
ax.text(7.25, 2.8, '监控系统', ha='center', va='center', fontsize=10, fontweight='bold', color='white')

# 绘制日志系统
log_box = FancyBboxPatch((6.5, 1.5), 1.5, 0.6, 
                         boxstyle="round,pad=0.05", 
                         facecolor=colors['support'], 
                         edgecolor='black', 
                         linewidth=1)
ax.add_patch(log_box)
ax.text(7.25, 1.8, '日志系统', ha='center', va='center', fontsize=10, fontweight='bold', color='white')

# 绘制备份系统
backup_box = FancyBboxPatch((6.5, 0.5), 1.5, 0.6, 
                            boxstyle="round,pad=0.05", 
                            facecolor=colors['support'], 
                            edgecolor='black', 
                            linewidth=1)
ax.add_patch(backup_box)
ax.text(7.25, 0.8, '备份系统', ha='center', va='center', fontsize=10, fontweight='bold', color='white')

# 绘制连接箭头
# 用户请求到负载均衡器
arrow1 = ConnectionPatch((2.5, 10.9), (3.5, 10.9), "data", "data",
                        arrowstyle="->", shrinkA=5, shrinkB=5, mutation_scale=20, fc="black", ec="black", linewidth=2)
ax.add_patch(arrow1)

# 负载均衡器到Web服务器集群
arrow2 = ConnectionPatch((6.5, 10.9), (7.5, 10.9), "data", "data",
                        arrowstyle="->", shrinkA=5, shrinkB=5, mutation_scale=20, fc="black", ec="black", linewidth=2)
ax.add_patch(arrow2)

# Web服务器集群到应用服务器
arrow3 = ConnectionPatch((8.5, 10.5), (5, 9.3), "data", "data",
                        arrowstyle="->", shrinkA=5, shrinkB=5, mutation_scale=20, fc="black", ec="black", linewidth=2)
ax.add_patch(arrow3)

# 应用服务器到各个服务
arrow4 = ConnectionPatch((3.5, 8.5), (1.5, 7.3), "data", "data",
                        arrowstyle="->", shrinkA=5, shrinkB=5, mutation_scale=20, fc="black", ec="black", linewidth=2)
ax.add_patch(arrow4)

arrow5 = ConnectionPatch((4.5, 8.5), (4.5, 7.3), "data", "data",
                        arrowstyle="->", shrinkA=5, shrinkB=5, mutation_scale=20, fc="black", ec="black", linewidth=2)
ax.add_patch(arrow5)

arrow6 = ConnectionPatch((5.5, 8.5), (7.5, 7.3), "data", "data",
                        arrowstyle="->", shrinkA=5, shrinkB=5, mutation_scale=20, fc="black", ec="black", linewidth=2)
ax.add_patch(arrow6)

arrow7 = ConnectionPatch((3.5, 8.5), (1.5, 5.3), "data", "data",
                        arrowstyle="->", shrinkA=5, shrinkB=5, mutation_scale=20, fc="black", ec="black", linewidth=2)
ax.add_patch(arrow7)

arrow8 = ConnectionPatch((5, 8.5), (4.5, 5.3), "data", "data",
                        arrowstyle="->", shrinkA=5, shrinkB=5, mutation_scale=20, fc="black", ec="black", linewidth=2)
ax.add_patch(arrow8)

# 添加标题
ax.text(5, 11.5, '系统部署架构图', ha='center', va='center', fontsize=20, fontweight='bold', color='black')

# 添加图例
legend_elements = [
    patches.Patch(color=colors['user'], label='用户层'),
    patches.Patch(color=colors['load_balancer'], label='负载均衡'),
    patches.Patch(color=colors['web_server'], label='Web服务'),
    patches.Patch(color=colors['app_server'], label='应用服务'),
    patches.Patch(color=colors['database'], label='数据存储'),
    patches.Patch(color=colors['cache'], label='缓存服务'),
    patches.Patch(color=colors['storage'], label='文件存储'),
    patches.Patch(color=colors['ai_service'], label='AI服务'),
    patches.Patch(color=colors['support'], label='支持系统')
]

ax.legend(handles=legend_elements, loc='upper right', bbox_to_anchor=(0.98, 0.98), fontsize=10)

# 保存图片
plt.tight_layout()
plt.savefig('system_architecture_diagram.png', dpi=300, bbox_inches='tight', facecolor='white')
plt.show()

print("系统部署架构图已生成: system_architecture_diagram.png") 