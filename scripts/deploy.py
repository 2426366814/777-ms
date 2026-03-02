#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
777-MS Memory System 部署脚本 (Python + Paramiko)
版本: v0.1.0
"""

import os
import sys
import paramiko
import scp
from pathlib import Path
import time

# 配置
CONFIG = {
    'host': '134.185.111.25',
    'port': 1022,
    'username': 'root',
    'password': 'C^74+ek@dN',  # SSH密码
    'key_filename': None,  # SSH 私钥路径，如: '/home/user/.ssh/id_rsa'
    'remote_dir': '/home/wwwroot/memory.91wz.org',  # 根据DEVELOPMENT.md文档配置
    'service_name': '777-ms'
}

def print_status(message, emoji=''):
    """打印状态信息"""
    print(f"{emoji} {message}")

def ssh_connect():
    """建立 SSH 连接"""
    print_status("建立 SSH 连接...", "🔗")
    
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
        print_status("SSH 连接成功！", "✅")
        return client
    except Exception as e:
        print_status(f"SSH 连接失败: {e}", "❌")
        sys.exit(1)

def exec_command(client, command, description=""):
    """执行远程命令"""
    if description:
        print_status(f"{description}...")
    
    stdin, stdout, stderr = client.exec_command(command)
    
    # 读取输出
    output = stdout.read().decode('utf-8')
    error = stderr.read().decode('utf-8')
    
    exit_code = stdout.channel.recv_exit_status()
    
    if exit_code != 0:
        print_status(f"命令执行失败 (exit {exit_code}): {error}", "❌")
        return None
    
    return output

def upload_file(scp_client, local_path, remote_path):
    """上传文件/目录"""
    print_status(f"上传: {local_path} -> {remote_path}", "📤")
    
    try:
        if os.path.isdir(local_path):
            scp_client.put(local_path, remote_path, recursive=True)
        else:
            scp_client.put(local_path, remote_path)
        return True
    except Exception as e:
        print_status(f"上传失败: {e}", "❌")
        return False

def deploy():
    """执行部署"""
    print_status("开始部署 777-MS Memory System...", "🚀")
    print_status(f"目标服务器: {CONFIG['host']}:{CONFIG['port']}", "📡")
    print_status(f"远程目录: {CONFIG['remote_dir']}", "📁")
    print()
    
    # 1. 建立 SSH 连接
    client = ssh_connect()
    
    try:
        # 2. 创建远程目录
        print_status("创建远程目录...", "📂")
        exec_command(client, f"mkdir -p {CONFIG['remote_dir']}")
        
        # 3. 上传文件
        print_status("同步文件到远程服务器...", "📤")
        
        # 使用 SCP 传输文件
        with scp.SCPClient(client.get_transport()) as scp_client:
            files_to_copy = [
                'package.json',
                'package-lock.json',
                'server.js',
                '.env',
                'config',
                'src',
                'web',
                'scripts',
                'database'
            ]
            
            project_root = Path(__file__).parent.parent
            
            for file in files_to_copy:
                local_path = project_root / file
                if local_path.exists():
                    remote_path = f"{CONFIG['remote_dir']}/{file}"
                    upload_file(scp_client, str(local_path), remote_path)
                else:
                    print_status(f"跳过不存在的文件: {file}", "⚠️")
        
        # 4. 在远程服务器执行安装和启动
        print_status("在远程服务器安装依赖...", "🔧")
        
        commands = f"""
cd {CONFIG['remote_dir']}

echo "📦 安装 npm 依赖..."
npm install --production

# 创建日志目录
mkdir -p logs

# 设置环境变量
export NODE_ENV=production
export PORT=1777

# 检查 PM2
if command -v pm2 &> /dev/null; then
    echo "🔄 使用 PM2 启动服务..."
    pm2 restart {CONFIG['service_name']} || pm2 start server.js --name {CONFIG['service_name']}
    pm2 save
else
    echo "⚠️ PM2 未安装，使用 nohup 启动..."
    # 停止旧进程
    pkill -f "node server.js" || true
    sleep 1
    # 启动新进程
    nohup node server.js > logs/server.log 2>&1 &
fi

echo "✅ 部署完成！"
echo "🌐 服务地址: http://{CONFIG['host']}:1777"
"""
        
        output = exec_command(client, commands, "执行远程部署命令")
        if output:
            print(output)
        
        print()
        print_status("部署成功！", "🎉")
        print_status(f"服务器: http://{CONFIG['host']}:1777", "📡")
        print_status(f"健康检查: http://{CONFIG['host']}:1777/health", "🔍")
        
    except Exception as e:
        print_status(f"部署失败: {e}", "❌")
        sys.exit(1)
    finally:
        client.close()
        print_status("SSH 连接已关闭", "🔒")

if __name__ == '__main__':
    # 检查 paramiko 和 scp
    try:
        import paramiko
        import scp
    except ImportError:
        print_status("正在安装必要的 Python 库...", "📦")
        os.system(f"{sys.executable} -m pip install paramiko scp")
        print_status("请重新运行部署脚本", "🔄")
        sys.exit(0)
    
    # 提示输入密码
    if CONFIG['password'] == 'your-password':
        import getpass
        CONFIG['password'] = getpass.getpass("请输入远程服务器密码: ")
    
    deploy()
