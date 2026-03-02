#!/usr/bin/env python3
"""
SSH远程操作脚本 - 直接在服务器上执行命令
"""

import paramiko
import sys

CONFIG = {
    'host': '134.185.111.25',
    'port': 1022,
    'username': 'root',
    'password': 'C^74+ek@dN',
    'remote_dir': '/home/wwwroot/memory.91wz.org'
}

def ssh_exec(command):
    """执行远程命令"""
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
        
        stdin, stdout, stderr = client.exec_command(command)
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        
        if output:
            print(output)
        if error:
            print(f"Error: {error}", file=sys.stderr)
            
        return output, error
    finally:
        client.close()

if __name__ == '__main__':
    if len(sys.argv) > 1:
        command = ' '.join(sys.argv[1:])
    else:
        command = f"cd {CONFIG['remote_dir']} && ls -la"
    
    print(f"执行: {command}")
    print("-" * 50)
    ssh_exec(command)
