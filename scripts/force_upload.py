#!/usr/bin/env python3
import paramiko
import scp
from pathlib import Path

CONFIG = {
    'host': '134.185.111.25',
    'port': 1022,
    'username': 'root',
    'password': 'C^74+ek@dN',
    'remote_dir': '/home/wwwroot/memory.91wz.org',
}

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(CONFIG['host'], CONFIG['port'], CONFIG['username'], CONFIG['password'])

# 删除远程src目录
print("删除远程src目录...")
stdin, stdout, stderr = client.exec_command(f"rm -rf {CONFIG['remote_dir']}/src")
stdout.read()

# 重新上传src目录
print("重新上传src目录...")
project_root = Path(__file__).parent.parent
local_src = project_root / 'src'

with scp.SCPClient(client.get_transport()) as scp_client:
    scp_client.put(str(local_src), f"{CONFIG['remote_dir']}/src", recursive=True)

# 重启服务
print("重启服务...")
stdin, stdout, stderr = client.exec_command(f"cd {CONFIG['remote_dir']} && pm2 restart 777-ms")
stdout.read()

# 验证
stdin, stdout, stderr = client.exec_command("grep -A5 'INSERT INTO memories' /home/wwwroot/memory.91wz.org/src/services/MemoryService.js")
print("验证文件内容:")
print(stdout.read().decode())

client.close()
