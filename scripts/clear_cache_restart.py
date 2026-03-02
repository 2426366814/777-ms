import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 清除 Node.js 缓存并重启
    cmds = [
        'pm2 stop 777-ms',
        'pm2 delete 777-ms',
        'cd /home/wwwroot/memory.91wz.org && rm -rf node_modules/.cache',
        'cd /home/wwwroot/memory.91wz.org && pm2 start server.js --name 777-ms',
        'pm2 save',
        'sleep 3',
        'pm2 logs 777-ms --lines 10 --nostream'
    ]
    
    for cmd in cmds:
        print(f'执行: {cmd}')
        stdin, stdout, stderr = ssh.exec_command(cmd)
        print(stdout.read().decode())
        err = stderr.read().decode()
        if err and 'error' in err.lower():
            print(f'Error: {err}')
    
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
