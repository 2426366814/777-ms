import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 方法1: 通过 Cloudflare API 清除缓存 (需要 API Token)
    # 方法2: 修改文件名添加版本号
    # 方法3: 设置 Cache-Control 头
    
    # 先检查 Nginx 配置中的缓存设置
    cmd = "grep -r 'Cache-Control' /www/server/panel/vhost/nginx/ 2>/dev/null | head -10"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print('=== Nginx Cache-Control 设置 ===')
    print(stdout.read().decode())
    
    # 检查是否有 Cloudflare 配置
    cmd2 = "ls -la /root/.cloudflare* 2>/dev/null || echo 'No Cloudflare config found'"
    stdin, stdout, stderr = ssh.exec_command(cmd2)
    print('=== Cloudflare 配置 ===')
    print(stdout.read().decode())
    
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
