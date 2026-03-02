#!/usr/bin/env python3
"""
777-MS 同步所有更新到远程服务器
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
    print("🚀 同步所有更新到远程服务器")
    print("="*60)
    
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(SSH_HOST, port=SSH_PORT, username=SSH_USER, password=SSH_PASSWORD)
        sftp = ssh.open_sftp()
        
        print("\n📁 上传前端文件...")
        
        web_files = [
            ("web/dashboard.html", "web/dashboard.html"),
            ("web/admin.html", "web/admin.html"),
            ("web/chat.html", "web/chat.html"),
            ("web/index.html", "web/index.html"),
            ("web/landing.html", "web/landing.html"),
            ("web/intelligence.html", "web/intelligence.html"),
            ("web/review.html", "web/review.html"),
            ("web/visualization.html", "web/visualization.html"),
            ("web/security.html", "web/security.html"),
            ("web/providers.html", "web/providers.html"),
            ("web/share.html", "web/share.html"),
            ("web/styles.css", "web/styles.css"),
        ]
        
        for local_rel, remote_rel in web_files:
            local_path = os.path.join(LOCAL_DIR, local_rel)
            remote_path = f"{SITE_DIR}/{remote_rel}"
            if os.path.exists(local_path):
                upload_file(sftp, local_path, remote_path)
        
        print("\n📁 上传后端服务文件...")
        
        backend_files = [
            ("src/services/VisualizationService.js", "src/services/VisualizationService.js"),
            ("src/services/ForgettingCurveService.js", "src/services/ForgettingCurveService.js"),
            ("src/services/KnowledgeGraphService.js", "src/services/KnowledgeGraphService.js"),
            ("src/routes/llm.js", "src/routes/llm.js"),
            ("src/routes/admin.js", "src/routes/admin.js"),
        ]
        
        for local_rel, remote_rel in backend_files:
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
        print("✅ 同步完成！")
        print("="*60)
        
    except Exception as e:
        print(f"❌ 错误: {e}")

if __name__ == "__main__":
    main()
