import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 清除 Cloudflare 缓存 - 通过删除服务器端缓存
    cmd = '''
    # 检查 admin.html 的修改时间
    ls -la /home/wwwroot/memory.91wz.org/web/admin.html
    
    # 强制 PM2 重启
    pm2 restart 777-ms --update-env
    
    # 等待重启
    sleep 2
    
    # 检查服务状态
    pm2 status
    '''
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode())
    print(stderr.read().decode())
    
    print('Done!')
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
