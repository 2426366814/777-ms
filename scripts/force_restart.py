import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 强制停止并重启 PM2
    cmds = [
        'pm2 stop 777-ms',
        'pm2 delete 777-ms',
        'cd /home/wwwroot/memory.91wz.org && pm2 start src/app.js --name 777-ms',
        'pm2 save'
    ]
    
    for cmd in cmds:
        stdin, stdout, stderr = ssh.exec_command(cmd)
        print(stdout.read().decode())
        err = stderr.read().decode()
        if err:
            print(f'Error: {err}')
    
    # 检查状态
    stdin, stdout, stderr = ssh.exec_command('pm2 status')
    print(stdout.read().decode())
    
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
