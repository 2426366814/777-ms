import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 查看密码哈希
    cmd = "mysql -u memory -p'ck123456@' memory -e \"SELECT username, LEFT(password, 30) as pwd_prefix, LENGTH(password) as pwd_len FROM users WHERE username = 'admin';\""
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print('=== Admin 密码信息 ===')
    print(stdout.read().decode())
    
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
