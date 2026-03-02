import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 检查服务器上的 database.js 是否有 queryOne
    cmd = "grep 'queryOne' /home/wwwroot/memory.91wz.org/src/utils/database.js"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    result = stdout.read().decode()
    print('=== queryOne 检查 ===')
    print(result if result else '没有找到 queryOne 函数！')
    
    # 检查 module.exports
    cmd2 = "grep -A5 'module.exports' /home/wwwroot/memory.91wz.org/src/utils/database.js"
    stdin, stdout, stderr = ssh.exec_command(cmd2)
    print('=== module.exports ===')
    print(stdout.read().decode())
    
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
