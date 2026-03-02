import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 检查 token 检查逻辑
    cmd = "grep -n 'token' /home/wwwroot/memory.91wz.org/web/admin.html | head -20"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print('=== Token 相关代码 ===')
    print(stdout.read().decode())
    
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
