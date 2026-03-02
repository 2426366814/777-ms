#!/usr/bin/env python3
"""
777-MS 清理过时脚本
删除所有过时的调试、检查、修复脚本
"""

import os
import glob

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))

KEEP_FILES = {
    'deep_inspect_v82.py',
    'deploy.py',
    'quick_fix_all_v2.py',
    'cleanup_old_scripts.py',
}

def cleanup():
    print("\n" + "="*60)
    print("🧹 清理过时脚本")
    print("="*60)
    
    all_files = glob.glob(os.path.join(SCRIPTS_DIR, '*.py')) + glob.glob(os.path.join(SCRIPTS_DIR, '*.sh')) + glob.glob(os.path.join(SCRIPTS_DIR, '*.ps1')) + glob.glob(os.path.join(SCRIPTS_DIR, '*.js'))
    
    deleted = 0
    kept = 0
    
    for f in all_files:
        basename = os.path.basename(f)
        if basename in KEEP_FILES:
            kept += 1
            print(f"  ✅ 保留: {basename}")
        else:
            try:
                os.remove(f)
                deleted += 1
                print(f"  🗑️ 删除: {basename}")
            except Exception as e:
                print(f"  ❌ 删除失败: {basename} - {e}")
    
    print("\n" + "="*60)
    print(f"✅ 清理完成！删除 {deleted} 个文件，保留 {kept} 个文件")
    print("="*60)

if __name__ == "__main__":
    cleanup()
