import paramiko
import re
import os

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 更新所有 HTML 文件的 CSS 版本号
    html_files = [
        'profile.html', 'dashboard.html', 'security.html', 'visualization.html',
        'intelligence.html', 'chat.html', 'knowledge.html', 'providers.html',
        'api.html', 'review.html', 'index.html', 'login.html', 'register.html',
        'docs.html', 'pricing.html', 'status.html', 'privacy.html'
    ]
    
    sftp = ssh.open_sftp()
    
    local_dir = r'e:/ai本地应用/记忆体/777-ms/web'
    remote_dir = '/home/wwwroot/memory.91wz.org/web'
    
    for f in html_files:
        local_path = os.path.join(local_dir, f)
        if os.path.exists(local_path):
            # 读取本地文件
            with open(local_path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            # 更新 CSS 版本号
            content = re.sub(r'href="/styles\.css"', 'href="/styles.css?v=20260228"', content)
            content = re.sub(r'href="/styles\.css\?v=\d+"', 'href="/styles.css?v=20260228"', content)
            
            # 写回本地文件
            with open(local_path, 'w', encoding='utf-8') as file:
                file.write(content)
            
            # 上传到服务器
            remote_path = f'{remote_dir}/{f}'
            sftp.put(local_path, remote_path)
            print(f'Updated: {f}')
    
    sftp.close()
    
    # 重启服务
    stdin, stdout, stderr = ssh.exec_command('pm2 restart 777-ms')
    print(stdout.read().decode())
    
    print('Done!')
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
