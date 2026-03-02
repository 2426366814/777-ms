import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 完整查看 database.js 文件
    cmd = "cat /home/wwwroot/memory.91wz.org/src/utils/database.js"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print('=== database.js 完整内容 ===')
    print(stdout.read().decode())
    
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
