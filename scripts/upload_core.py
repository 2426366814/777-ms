#!/usr/bin/env python3
"""
上传所有核心文件到服务器
"""

import paramiko
import scp
from pathlib import Path

CONFIG = {
    'host': '134.185.111.25',
    'port': 1022,
    'username': 'root',
    'password': 'C^74+ek@dN',
    'remote_dir': '/home/wwwroot/memory.91wz.org'
}

def upload_all():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        client.connect(
            hostname=CONFIG['host'],
            port=CONFIG['port'],
            username=CONFIG['username'],
            password=CONFIG['password'],
            timeout=30
        )
        
        project_root = Path(__file__).parent.parent
        
        files_to_upload = {
            # 主文件
            'server.js': f"{CONFIG['remote_dir']}/server.js",
            
            # 服务文件
            'src/services/MemoryService.js': f"{CONFIG['remote_dir']}/src/services/MemoryService.js",
            'src/services/KnowledgeService.js': f"{CONFIG['remote_dir']}/src/services/KnowledgeService.js",
            'src/services/ReviewService.js': f"{CONFIG['remote_dir']}/src/services/ReviewService.js",
            'src/services/AutoManager.js': f"{CONFIG['remote_dir']}/src/services/AutoManager.js",
            'src/services/LLMService.js': f"{CONFIG['remote_dir']}/src/services/LLMService.js",
            'src/services/MemoryExtractor.js': f"{CONFIG['remote_dir']}/src/services/MemoryExtractor.js",
            
            # 路由文件
            'src/routes/chat.js': f"{CONFIG['remote_dir']}/src/routes/chat.js",
            'src/routes/ide.js': f"{CONFIG['remote_dir']}/src/routes/ide.js",
            'src/routes/memory.js': f"{CONFIG['remote_dir']}/src/routes/memory.js",
            'src/routes/providers.js': f"{CONFIG['remote_dir']}/src/routes/providers.js",
            'src/routes/user.js': f"{CONFIG['remote_dir']}/src/routes/user.js",
            'src/routes/knowledge.js': f"{CONFIG['remote_dir']}/src/routes/knowledge.js",
            
            # 数据库迁移
            'database/migrations/004_create_memories_table.sql': f"{CONFIG['remote_dir']}/database/migrations/004_create_memories_table.sql",
        }
        
        with scp.SCPClient(client.get_transport()) as scp_client:
            for local, remote in files_to_upload.items():
                local_path = project_root / local
                if local_path.exists():
                    print(f"📤 上传: {local} -> {remote}")
                    scp_client.put(str(local_path), remote)
                else:
                    print(f"⚠️ 不存在: {local}")
        
        print("\n✅ 上传完成！")
        
        # 重启服务
        print("\n🔄 重启服务...")
        stdin, stdout, stderr = client.exec_command(f"cd {CONFIG['remote_dir']} && pm2 restart 777-ms")
        print(stdout.read().decode('utf-8'))
        
        # 检查状态
        print("\n📋 服务状态...")
        stdin, stdout, stderr = client.exec_command("pm2 status")
        print(stdout.read().decode('utf-8'))
        
    finally:
        client.close()

if __name__ == '__main__':
    upload_all()
