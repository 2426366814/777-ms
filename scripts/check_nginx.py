import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 检查当前 Nginx 配置
    cmd = "cat /www/server/panel/vhost/nginx/memory.91wz.org.conf"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print('=== 当前 Nginx 配置 ===')
    print(stdout.read().decode())
    
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
