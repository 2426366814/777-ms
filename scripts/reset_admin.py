import paramiko
import bcrypt

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 生成密码哈希
    password = 'admin123456'
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # 更新 admin 密码
    cmd = f"mysql -u memory -p'ck123456@' memory -e \"UPDATE users SET password = '{hashed}' WHERE username = 'admin';\""
    stdin, stdout, stderr = ssh.exec_command(cmd)
    stdout.read()
    err = stderr.read().decode()
    if 'Warning' in err or not err:
        print('Admin password updated successfully!')
    else:
        print('Error:', err)
    
    # 验证更新
    cmd2 = "mysql -u memory -p'ck123456@' memory -e \"SELECT username, role FROM users WHERE username = 'admin';\""
    stdin, stdout, stderr = ssh.exec_command(cmd2)
    print('=== 验证 admin 用户 ===')
    print(stdout.read().decode())
    
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
