#!/usr/bin/env python3
"""
上传缺失的web文件到服务器
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

def upload_missing_files():
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
        web_dir = project_root / 'web'
        
        missing_files = ['knowledge.html', 'api.html', 'profile.html']
        
        with scp.SCPClient(client.get_transport()) as scp_client:
            for filename in missing_files:
                local_path = web_dir / filename
                if local_path.exists():
                    remote_path = f"{CONFIG['remote_dir']}/web/{filename}"
                    print(f"📤 上传: {filename} -> {remote_path}")
                    scp_client.put(str(local_path), remote_path)
                else:
                    print(f"⚠️ 本地不存在: {filename}")
        
        print("\n✅ 上传完成！")
        
        # 验证
        print("\n📋 验证服务器文件...")
        stdin, stdout, stderr = client.exec_command(f"ls -la {CONFIG['remote_dir']}/web/")
        print(stdout.read().decode('utf-8'))
        
    finally:
        client.close()

if __name__ == '__main__':
    upload_missing_files()
