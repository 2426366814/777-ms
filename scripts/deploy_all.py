import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    sftp = ssh.open_sftp()
    
    # 上传修复后的 database.js
    local = r'e:/ai本地应用/记忆体/777-ms/src/utils/database.js'
    remote = '/home/wwwroot/memory.91wz.org/src/utils/database.js'
    sftp.put(local, remote)
    print(f'Uploaded: {remote}')
    
    # 上传修复后的 admin.html
    local = r'e:/ai本地应用/记忆体/777-ms/web/admin.html'
    remote = '/home/wwwroot/memory.91wz.org/web/admin.html'
    sftp.put(local, remote)
    print(f'Uploaded: {remote}')
    
    sftp.close()
    
    # 重启服务
    stdin, stdout, stderr = ssh.exec_command('pm2 restart 777-ms')
    print(stdout.read().decode())
    
    print('Done!')
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
