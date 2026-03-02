import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 检查 PM2 日志中的 401 错误
    cmd = "pm2 logs 777-ms --lines 50 --nostream 2>&1 | grep -E '401|Unauthorized|admin/users'"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print('=== 401 错误日志 ===')
    result = stdout.read().decode()
    print(result if result else '没有找到 401 错误')
    
    # 检查最近的请求
    cmd2 = "pm2 logs 777-ms --lines 30 --nostream 2>&1"
    stdin, stdout, stderr = ssh.exec_command(cmd2)
    print('=== 最近日志 ===')
    print(stdout.read().decode())
    
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
