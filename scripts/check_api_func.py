import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 检查 admin.html 中 api 函数
    cmd = "grep -A8 'async function api' /home/wwwroot/memory.91wz.org/web/admin.html"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print('=== api 函数 ===')
    print(stdout.read().decode())
    
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
