import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 使用 server.js 启动
    cmd = "cd /home/wwwroot/memory.91wz.org && pm2 start server.js --name 777-ms"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode())
    print(stderr.read().decode())
    
    # 保存 PM2 配置
    stdin, stdout, stderr = ssh.exec_command('pm2 save')
    print(stdout.read().decode())
    
    # 检查状态
    stdin, stdout, stderr = ssh.exec_command('pm2 status')
    print(stdout.read().decode())
    
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
