import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch, ConnectionPatch
import numpy as np

# Create figure
fig, ax = plt.subplots(1, 1, figsize=(16, 12))
ax.set_xlim(0, 10)
ax.set_ylim(0, 12)
ax.axis('off')

# Define colors
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

# Draw user request
user_box = FancyBboxPatch((0.5, 10.5), 2, 0.8, 
                          boxstyle="round,pad=0.1", 
                          facecolor=colors['user'], 
                          edgecolor='black', 
                          linewidth=2)
ax.add_patch(user_box)
ax.text(1.5, 10.9, 'User Request', ha='center', va='center', fontsize=12, fontweight='bold', color='white')

# Draw load balancer
lb_box = FancyBboxPatch((3.5, 10.5), 3, 0.8, 
                        boxstyle="round,pad=0.1", 
                        facecolor=colors['load_balancer'], 
                        edgecolor='black', 
                        linewidth=2)
ax.add_patch(lb_box)
ax.text(5, 10.9, 'Load Balancer', ha='center', va='center', fontsize=12, fontweight='bold', color='white')

# Draw Web server cluster
web_box = FancyBboxPatch((7.5, 10.5), 2, 0.8, 
                         boxstyle="round,pad=0.1", 
                         facecolor=colors['web_server'], 
                         edgecolor='black', 
                         linewidth=2)
ax.add_patch(web_box)
ax.text(8.5, 10.9, 'Web Server Cluster', ha='center', va='center', fontsize=12, fontweight='bold', color='white')

# Draw application server
app_box = FancyBboxPatch((3.5, 8.5), 3, 0.8, 
                         boxstyle="round,pad=0.1", 
                         facecolor=colors['app_server'], 
                         edgecolor='black', 
                         linewidth=2)
ax.add_patch(app_box)
ax.text(5, 8.9, 'Application Server', ha='center', va='center', fontsize=12, fontweight='bold', color='white')

# Draw database cluster
db_box = FancyBboxPatch((0.5, 6.5), 2, 0.8, 
                        boxstyle="round,pad=0.1", 
                        facecolor=colors['database'], 
                        edgecolor='black', 
                        linewidth=2)
ax.add_patch(db_box)
ax.text(1.5, 6.9, 'Database Cluster', ha='center', va='center', fontsize=12, fontweight='bold', color='white')

# Draw Redis cache
cache_box = FancyBboxPatch((3.5, 6.5), 2, 0.8, 
                           boxstyle="round,pad=0.1", 
                           facecolor=colors['cache'], 
                           edgecolor='black', 
                           linewidth=2)
ax.add_patch(cache_box)
ax.text(4.5, 6.9, 'Redis Cache', ha='center', va='center', fontsize=12, fontweight='bold', color='white')

# Draw file storage
storage_box = FancyBboxPatch((6.5, 6.5), 2, 0.8, 
                             boxstyle="round,pad=0.1", 
                             facecolor=colors['storage'], 
                             edgecolor='black', 
                             linewidth=2)
ax.add_patch(storage_box)
ax.text(7.5, 6.9, 'File Storage', ha='center', va='center', fontsize=12, fontweight='bold', color='white')

# Draw AI service cluster
ai_box = FancyBboxPatch((0.5, 4.5), 2, 0.8, 
                        boxstyle="round,pad=0.1", 
                        facecolor=colors['ai_service'], 
                        edgecolor='black', 
                        linewidth=2)
ax.add_patch(ai_box)
ax.text(1.5, 4.9, 'AI Service Cluster', ha='center', va='center', fontsize=12, fontweight='bold', color='white')

# Draw image processing cluster
img_box = FancyBboxPatch((3.5, 4.5), 2, 0.8, 
                         boxstyle="round,pad=0.1", 
                         facecolor=colors['ai_service'], 
                         edgecolor='black', 
                         linewidth=2)
ax.add_patch(img_box)
ax.text(4.5, 4.9, 'Image Processing Cluster', ha='center', va='center', fontsize=12, fontweight='bold', color='white')

# Draw support system title
ax.text(6.5, 4.9, 'Support Systems', ha='center', va='center', fontsize=14, fontweight='bold', color='black')

# Draw CDN acceleration
cdn_box = FancyBboxPatch((6.5, 3.5), 1.5, 0.6, 
                         boxstyle="round,pad=0.05", 
                         facecolor=colors['support'], 
                         edgecolor='black', 
                         linewidth=1)
ax.add_patch(cdn_box)
ax.text(7.25, 3.8, 'CDN', ha='center', va='center', fontsize=10, fontweight='bold', color='white')

# Draw monitoring system
monitor_box = FancyBboxPatch((6.5, 2.5), 1.5, 0.6, 
                             boxstyle="round,pad=0.05", 
                             facecolor=colors['support'], 
                             edgecolor='black', 
                             linewidth=1)
ax.add_patch(monitor_box)
ax.text(7.25, 2.8, 'Monitoring', ha='center', va='center', fontsize=10, fontweight='bold', color='white')

# Draw logging system
log_box = FancyBboxPatch((6.5, 1.5), 1.5, 0.6, 
                         boxstyle="round,pad=0.05", 
                         facecolor=colors['support'], 
                         edgecolor='black', 
                         linewidth=1)
ax.add_patch(log_box)
ax.text(7.25, 1.8, 'Logging', ha='center', va='center', fontsize=10, fontweight='bold', color='white')

# Draw backup system
backup_box = FancyBboxPatch((6.5, 0.5), 1.5, 0.6, 
                            boxstyle="round,pad=0.05", 
                            facecolor=colors['support'], 
                            edgecolor='black', 
                            linewidth=1)
ax.add_patch(backup_box)
ax.text(7.25, 0.8, 'Backup', ha='center', va='center', fontsize=10, fontweight='bold', color='white')

# Draw connection arrows
# User request to load balancer
arrow1 = ConnectionPatch((2.5, 10.9), (3.5, 10.9), "data", "data",
                        arrowstyle="->", shrinkA=5, shrinkB=5, mutation_scale=20, fc="black", ec="black", linewidth=2)
ax.add_patch(arrow1)

# Load balancer to Web server cluster
arrow2 = ConnectionPatch((6.5, 10.9), (7.5, 10.9), "data", "data",
                        arrowstyle="->", shrinkA=5, shrinkB=5, mutation_scale=20, fc="black", ec="black", linewidth=2)
ax.add_patch(arrow2)

# Web server cluster to application server
arrow3 = ConnectionPatch((8.5, 10.5), (5, 9.3), "data", "data",
                        arrowstyle="->", shrinkA=5, shrinkB=5, mutation_scale=20, fc="black", ec="black", linewidth=2)
ax.add_patch(arrow3)

# Application server to various services
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

# Add title
ax.text(5, 11.5, 'System Deployment Architecture', ha='center', va='center', fontsize=20, fontweight='bold', color='black')

# Add legend
legend_elements = [
    patches.Patch(color=colors['user'], label='User Layer'),
    patches.Patch(color=colors['load_balancer'], label='Load Balancing'),
    patches.Patch(color=colors['web_server'], label='Web Services'),
    patches.Patch(color=colors['app_server'], label='Application Services'),
    patches.Patch(color=colors['database'], label='Data Storage'),
    patches.Patch(color=colors['cache'], label='Cache Services'),
    patches.Patch(color=colors['storage'], label='File Storage'),
    patches.Patch(color=colors['ai_service'], label='AI Services'),
    patches.Patch(color=colors['support'], label='Support Systems')
]

ax.legend(handles=legend_elements, loc='upper right', bbox_to_anchor=(0.98, 0.98), fontsize=10)

# Save image
plt.tight_layout()
plt.savefig('system_architecture_diagram_en.png', dpi=300, bbox_inches='tight', facecolor='white')
plt.show()

print("English system deployment architecture diagram generated: system_architecture_diagram_en.png") 