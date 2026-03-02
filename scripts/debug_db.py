import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 检查 LLMService.js 中的 db 导入
    cmd = "head -5 /home/wwwroot/memory.91wz.org/src/services/LLMService.js"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print('=== LLMService.js 头部 ===')
    print(stdout.read().decode())
    
    # 检查 LLMService.js 第 46 行
    cmd2 = "sed -n '44,52p' /home/wwwroot/memory.91wz.org/src/services/LLMService.js"
    stdin, stdout, stderr = ssh.exec_command(cmd2)
    print('=== LLMService.js 第 44-52 行 ===')
    print(stdout.read().decode())
    
    # 测试 db 模块
    cmd3 = '''cd /home/wwwroot/memory.91wz.org && node -e "
const db = require('./src/utils/database');
console.log('db module:', Object.keys(db));
console.log('queryOne exists:', typeof db.queryOne);
"'''
    stdin, stdout, stderr = ssh.exec_command(cmd3)
    print('=== db 模块测试 ===')
    print(stdout.read().decode())
    print(stderr.read().decode())
    
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
