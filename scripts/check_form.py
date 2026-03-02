import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 检查 admin.html 中的表单 HTML
    cmd = "grep -A5 'newRole' /home/wwwroot/memory.91wz.org/web/admin.html | head -20"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print('=== 表单 HTML ===')
    print(stdout.read().decode())
    
    # 检查创建按钮的 onclick
    cmd2 = "grep 'onclick.*createUser' /home/wwwroot/memory.91wz.org/web/admin.html"
    stdin, stdout, stderr = ssh.exec_command(cmd2)
    print('=== 创建按钮 onclick ===')
    result = stdout.read().decode()
    print(result if result else '没有找到 onclick createUser')
    
    # 检查按钮定义
    cmd3 = "grep -B2 -A2 '创建' /home/wwwroot/memory.91wz.org/web/admin.html | head -20"
    stdin, stdout, stderr = ssh.exec_command(cmd3)
    print('=== 创建按钮定义 ===')
    print(stdout.read().decode())
    
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
