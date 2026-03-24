#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import json
import os
from pathlib import Path

def simple_photo_check(photo_path):
    """简单的照片检查，返回基本信息"""
    try:
        from PIL import Image
        
        # 检查文件是否存在
        if not os.path.exists(photo_path):
            return {
                "success": False,
                "message": "照片文件不存在",
                "error": "File not found"
            }
        
        # 打开并分析图片
        with Image.open(photo_path) as img:
            width, height = img.size
            file_size = os.path.getsize(photo_path) / 1024  # KB
            
            # 基本检查
            checks = []
            is_valid = True
            
            # 检查文件大小
            if file_size > 240:
                checks.append(f"文件过大: {file_size:.1f}KB (最大240KB)")
                is_valid = False
            else:
                checks.append(f"文件大小合适: {file_size:.1f}KB")
            
            # 检查尺寸
            if width < 600 or height < 600:
                checks.append(f"分辨率过低: {width}x{height} (最小600x600)")
                is_valid = False
            else:
                checks.append(f"分辨率合适: {width}x{height}")
            
            # 检查宽高比
            ratio = width / height
            if not (0.75 <= ratio <= 1.33):  # 3:4 到 4:3
                checks.append(f"宽高比不合适: {ratio:.2f}")
                is_valid = False
            else:
                checks.append("宽高比合适")
            
            result = {
                "success": is_valid,
                "message": "照片检查完成" if is_valid else "照片不符合要求",
                "file_size": file_size,
                "dimensions": {"width": width, "height": height},
                "checks": checks,
                "ai_suggestion": "建议使用标准证件照，确保头部占照片的70-80%，背景为纯色" if not is_valid else "照片符合基本要求"
            }
            
            return result
            
    except Exception as e:
        return {
            "success": False,
            "message": f"照片处理失败: {str(e)}",
            "error": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "message": "Usage: python check_photo_simple.py <photo_path>",
            "error": "Missing photo path"
        }))
        sys.exit(1)
    
    photo_path = sys.argv[1]
    result = simple_photo_check(photo_path)
    
    # 输出JSON结果（确保ASCII编码避免中文乱码）
    print(json.dumps(result, ensure_ascii=True, indent=2)) 