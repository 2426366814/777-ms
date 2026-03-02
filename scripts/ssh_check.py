import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 查看用户表
    cmd = "mysql -u memory -p'ck123456@' memory -e 'SELECT id, username, email, role, status FROM users LIMIT 10;'"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print('=== 用户列表 ===')
    print(stdout.read().decode())
    err = stderr.read().decode()
    if err:
        print('Error:', err)
    
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
