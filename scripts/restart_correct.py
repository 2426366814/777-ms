import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 查找入口文件
    cmd = "ls -la /home/wwwroot/memory.91wz.org/src/*.js"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print('=== src 目录下的 JS 文件 ===')
    print(stdout.read().decode())
    
    # 检查 package.json
    cmd2 = "cat /home/wwwroot/memory.91wz.org/package.json | grep -A2 'scripts'"
    stdin, stdout, stderr = ssh.exec_command(cmd2)
    print('=== package.json scripts ===')
    print(stdout.read().decode())
    
    # 使用正确的入口文件启动
    cmd3 = "cd /home/wwwroot/memory.91wz.org && pm2 start src/index.js --name 777-ms"
    stdin, stdout, stderr = ssh.exec_command(cmd3)
    print(stdout.read().decode())
    print(stderr.read().decode())
    
    # 检查状态
    stdin, stdout, stderr = ssh.exec_command('pm2 status')
    print(stdout.read().decode())
    
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
