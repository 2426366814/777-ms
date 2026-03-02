import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 检查 adminAuth 中间件
    cmd = "grep -A30 'const adminAuth' /home/wwwroot/memory.91wz.org/src/routes/admin.js"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print('=== adminAuth 中间件 ===')
    print(stdout.read().decode())
    
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
