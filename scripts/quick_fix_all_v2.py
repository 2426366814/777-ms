#!/usr/bin/env python3
"""
777-MS Memory System - Quick Fix All v2
快速修复所有问题并上传
"""

import paramiko
import os

SSH_HOST = "134.185.111.25"
SSH_PORT = 1022
SSH_USER = "root"
SSH_PASSWORD = "C^74+ek@dN"
SITE_DIR = "/home/wwwroot/memory.91wz.org"

LOCAL_DIR = r"e:\ai本地应用\记忆体\777-ms"

def run_ssh_command(ssh, cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd)
    return stdout.read().decode(), stderr.read().decode()

def upload_file(sftp, local_path, remote_path):
    try:
        sftp.put(local_path, remote_path)
        print(f"  ✅ 上传: {os.path.basename(local_path)}")
        return True
    except Exception as e:
        print(f"  ❌ 上传失败: {e}")
        return False

def main():
    print("\n" + "="*60)
    print("🔧 777-MS 快速修复所有问题 v2")
    print("="*60)
    
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(SSH_HOST, port=SSH_PORT, username=SSH_USER, password=SSH_PASSWORD)
        sftp = ssh.open_sftp()
        
        print("\n📁 上传修复文件...")
        
        files_to_upload = [
            ("src/services/VisualizationService.js", "src/services/VisualizationService.js"),
            ("src/services/ForgettingCurveService.js", "src/services/ForgettingCurveService.js"),
            ("src/services/KnowledgeGraphService.js", "src/services/KnowledgeGraphService.js"),
            ("src/routes/llm.js", "src/routes/llm.js"),
            ("src/routes/admin.js", "src/routes/admin.js"),
        ]
        
        for local_rel, remote_rel in files_to_upload:
            local_path = os.path.join(LOCAL_DIR, local_rel)
            remote_path = f"{SITE_DIR}/{remote_rel}"
            if os.path.exists(local_path):
                upload_file(sftp, local_path, remote_path)
        
        sftp.close()
        
        print("\n🔄 重启服务器...")
        output, error = run_ssh_command(ssh, "cd /home/wwwroot/memory.91wz.org && pm2 restart 777-ms")
        print(f"  重启结果: {output[:200] if output else error}")
        
        ssh.close()
        
        print("\n" + "="*60)
        print("✅ 修复完成！")
        print("="*60)
        
    except Exception as e:
        print(f"❌ 错误: {e}")

if __name__ == "__main__":
    main()
