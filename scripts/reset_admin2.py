import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 用 Node.js 生成密码哈希并更新
    cmd = '''cd /home/wwwroot/memory.91wz.org && node -e "
const bcrypt = require('bcryptjs');
const password = 'admin123456';
const hash = bcrypt.hashSync(password, 10);
console.log(hash);
"'''
    stdin, stdout, stderr = ssh.exec_command(cmd)
    hashed = stdout.read().decode().strip()
    print(f'Generated hash: {hashed[:50]}...')
    
    # 更新密码
    cmd2 = f"mysql -u memory -p'ck123456@' memory -e \"UPDATE users SET password = '{hashed}' WHERE username = 'admin';\""
    stdin, stdout, stderr = ssh.exec_command(cmd2)
    stdout.read()
    print('Password updated!')
    
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
