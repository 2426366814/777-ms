import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 直接在服务器上用 Node.js 更新密码
    cmd = '''cd /home/wwwroot/memory.91wz.org && node -e "
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function updatePassword() {
    const password = 'admin123456';
    const hash = bcrypt.hashSync(password, 10);
    console.log('Hash length:', hash.length);
    
    const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'memory',
        password: 'ck123456@',
        database: 'memory'
    });
    
    await conn.execute('UPDATE users SET password = ? WHERE username = ?', [hash, 'admin']);
    console.log('Password updated!');
    
    const [rows] = await conn.execute('SELECT username, LENGTH(password) as len FROM users WHERE username = ?', ['admin']);
    console.log('Verify:', rows);
    
    await conn.end();
}

updatePassword().catch(console.error);
"'''
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode())
    err = stderr.read().decode()
    if err:
        print('Error:', err)
    
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
