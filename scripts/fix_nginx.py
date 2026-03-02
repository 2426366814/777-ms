import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 创建日志目录
    cmd = 'mkdir -p /var/log/nginx && nginx -t && nginx -s reload'
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode())
    print(stderr.read().decode())
    
    print('Done!')
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
