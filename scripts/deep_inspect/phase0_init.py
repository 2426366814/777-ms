import paramiko
import json
import os

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

results = {
    "phase": 0,
    "name": "初始化 - 项目类型识别和预测分析",
    "project_type": None,
    "tech_stack": [],
    "risk_areas": [],
    "predictions": []
}

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('✅ SSH 连接成功')
    
    # 1. 项目类型识别
    cmds = {
        "package.json": "cat /home/wwwroot/memory.91wz.org/package.json 2>/dev/null | head -50",
        "目录结构": "ls -la /home/wwwroot/memory.91wz.org/",
        "src目录": "ls -la /home/wwwroot/memory.91wz.org/src/ 2>/dev/null",
        "web目录": "ls -la /home/wwwroot/memory.91wz.org/web/ 2>/dev/null",
        "环境变量": "cat /home/wwwroot/memory.91wz.org/.env 2>/dev/null | grep -v PASSWORD | grep -v SECRET | head -20"
    }
    
    for name, cmd in cmds.items():
        stdin, stdout, stderr = ssh.exec_command(cmd)
        print(f"\n=== {name} ===")
        print(stdout.read().decode())
    
    # 2. 技术栈识别
    tech_cmd = '''
    echo "=== Node.js 版本 ==="
    node -v
    echo "=== npm 版本 ==="
    npm -v
    echo "=== PM2 状态 ==="
    pm2 status
    echo "=== MySQL 版本 ==="
    mysql --version 2>/dev/null || echo "MySQL client not found"
    echo "=== Nginx 版本 ==="
    nginx -v 2>&1
    '''
    stdin, stdout, stderr = ssh.exec_command(tech_cmd)
    print(stdout.read().decode())
    
    # 3. 风险区域预测
    risk_cmd = '''
    echo "=== 敏感文件检测 ==="
    find /home/wwwroot/memory.91wz.org -name "*.env*" -o -name "*secret*" -o -name "*key*" 2>/dev/null | head -20
    echo "=== 认证相关文件 ==="
    find /home/wwwroot/memory.91wz.org/src -name "*auth*" -o -name "*login*" -o -name "*admin*" 2>/dev/null | head -20
    echo "=== 数据库相关文件 ==="
    find /home/wwwroot/memory.91wz.org/src -name "*database*" -o -name "*db*" -o -name "*model*" 2>/dev/null | head -20
    '''
    stdin, stdout, stderr = ssh.exec_command(risk_cmd)
    print(stdout.read().decode())
    
    # 4. 服务状态检查
    status_cmd = '''
    echo "=== 服务健康检查 ==="
    curl -s http://127.0.0.1:1777/api/v1/health 2>/dev/null || echo "Health endpoint not available"
    echo ""
    echo "=== 内存使用 ==="
    free -h
    echo ""
    echo "=== 磁盘使用 ==="
    df -h /home
    '''
    stdin, stdout, stderr = ssh.exec_command(status_cmd)
    print(stdout.read().decode())
    
    ssh.close()
    print("\n✅ Phase 0 完成")
except Exception as e:
    print(f'❌ Error: {e}')
