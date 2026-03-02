import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 清空旧日志并重启
    cmds = [
        'pm2 stop 777-ms',
        'rm -f /root/.pm2/logs/777-ms-error.log',
        'rm -f /root/.pm2/logs/777-ms-out.log',
        'cd /home/wwwroot/memory.91wz.org && pm2 start server.js --name 777-ms',
        'pm2 save',
        'sleep 5',
        'echo "=== 新日志 ==="',
        'pm2 logs 777-ms --lines 20 --nostream'
    ]
    
    for cmd in cmds:
        stdin, stdout, stderr = ssh.exec_command(cmd)
        print(stdout.read().decode())
    
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
