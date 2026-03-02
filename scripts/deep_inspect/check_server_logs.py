import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('✅ SSH 连接成功')
    
    # 检查服务器日志
    cmd = '''
    echo "=== PM2 日志 (最近 50 行) ==="
    pm2 logs 777-ms --lines 50 --nostream
    '''
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode())
    
    ssh.close()
except Exception as e:
    print(f'❌ Error: {e}')
