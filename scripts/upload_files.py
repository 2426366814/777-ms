#!/usr/bin/env python3
"""
直接上传单个文件到服务器
"""

import paramiko
import scp
import sys
from pathlib import Path

CONFIG = {
    'host': '134.185.111.25',
    'port': 1022,
    'username': 'root',
    'password': 'C^74+ek@dN',
    'remote_dir': '/home/wwwroot/memory.91wz.org'
}

def upload_files(files_map):
    """上传文件映射 {本地路径: 远程路径}"""
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
        
        with scp.SCPClient(client.get_transport()) as scp_client:
            for local_path, remote_path in files_map.items():
                print(f"📤 上传: {local_path} -> {remote_path}")
                scp_client.put(local_path, remote_path)
        
        print("✅ 上传完成！")
        
        # 重启服务
        print("🔄 重启服务...")
        stdin, stdout, stderr = client.exec_command(f"cd {CONFIG['remote_dir']} && pm2 restart 777-ms")
        print(stdout.read().decode('utf-8'))
        
    finally:
        client.close()

if __name__ == '__main__':
    project_root = Path(__file__).parent.parent
    
    files_to_upload = {
        str(project_root / 'web' / 'login.html'): f"{CONFIG['remote_dir']}/web/login.html",
        str(project_root / 'web' / 'index.html'): f"{CONFIG['remote_dir']}/web/index.html",
        str(project_root / 'server.js'): f"{CONFIG['remote_dir']}/server.js",
        str(project_root / 'src' / 'services' / 'MemoryService.js'): f"{CONFIG['remote_dir']}/src/services/MemoryService.js",
        str(project_root / 'src' / 'services' / 'KnowledgeService.js'): f"{CONFIG['remote_dir']}/src/services/KnowledgeService.js",
        str(project_root / 'src' / 'services' / 'ReviewService.js'): f"{CONFIG['remote_dir']}/src/services/ReviewService.js",
        str(project_root / 'src' / 'services' / 'AutoManager.js'): f"{CONFIG['remote_dir']}/src/services/AutoManager.js",
        str(project_root / 'src' / 'routes' / 'chat.js'): f"{CONFIG['remote_dir']}/src/routes/chat.js",
        str(project_root / 'src' / 'routes' / 'ide.js'): f"{CONFIG['remote_dir']}/src/routes/ide.js",
        str(project_root / 'src' / 'routes' / 'memory.js'): f"{CONFIG['remote_dir']}/src/routes/memory.js",
    }
    
    upload_files(files_to_upload)
