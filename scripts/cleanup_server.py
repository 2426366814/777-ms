#!/usr/bin/env python3
"""
777-MS 清理服务器过时代码
"""

import paramiko

SSH_HOST = "134.185.111.25"
SSH_PORT = 1022
SSH_USER = "root"
SSH_PASSWORD = "C^74+ek@dN"
SITE_DIR = "/home/wwwroot/memory.91wz.org"

def run_ssh_command(ssh, cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd)
    return stdout.read().decode(), stderr.read().decode()

def main():
    print("\n" + "="*60)
    print("🧹 清理服务器过时代码")
    print("="*60)
    
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(SSH_HOST, port=SSH_PORT, username=SSH_USER, password=SSH_PASSWORD)
        
        print("\n📁 检查服务器文件...")
        
        output, error = run_ssh_command(ssh, f"ls -la {SITE_DIR}/scripts/ 2>/dev/null | head -20")
        print(f"Scripts目录: {output[:500] if output else '不存在'}")
        
        output, error = run_ssh_command(ssh, f"ls -la {SITE_DIR}/public/ 2>/dev/null | head -20")
        print(f"Public目录: {output[:500] if output else '不存在'}")
        
        output, error = run_ssh_command(ssh, f"ls -la {SITE_DIR}/logs/ 2>/dev/null | head -10")
        print(f"Logs目录: {output[:300] if output else '不存在'}")
        
        print("\n🗑️ 清理过时文件...")
        
        cmds = [
            f"rm -rf {SITE_DIR}/scripts/*.py 2>/dev/null",
            f"rm -rf {SITE_DIR}/scripts/*.sh 2>/dev/null",
            f"rm -rf {SITE_DIR}/scripts/*.js 2>/dev/null",
            f"rm -rf {SITE_DIR}/public 2>/dev/null",
            f"find {SITE_DIR}/logs -name '*.log' -mtime +7 -delete 2>/dev/null",
            f"rm -rf {SITE_DIR}/*.bak 2>/dev/null",
            f"rm -rf {SITE_DIR}/src/**/*.bak 2>/dev/null",
        ]
        
        for cmd in cmds:
            output, error = run_ssh_command(ssh, cmd)
            print(f"  执行: {cmd.split()[1]}")
        
        print("\n📊 清理后目录结构:")
        output, error = run_ssh_command(ssh, f"ls -la {SITE_DIR}/")
        print(output[:1000])
        
        ssh.close()
        
        print("\n" + "="*60)
        print("✅ 服务器清理完成！")
        print("="*60)
        
    except Exception as e:
        print(f"❌ 错误: {e}")

if __name__ == "__main__":
    main()
