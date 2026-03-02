import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('SSH connected successfully!')
    
    # 更新 Nginx 配置添加 no-cache 头
    nginx_config = '''server {
    listen 80;
    server_name memory.91wz.org;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name memory.91wz.org;

    ssl_certificate /www/server/panel/vhost/cert/memory.91wz.org/fullchain.pem; 
    ssl_certificate_key /www/server/panel/vhost/cert/memory.91wz.org/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 禁止缓存 HTML 文件
    location ~* \\.html$ {
        proxy_pass http://127.0.0.1:1777;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    location / {
        proxy_pass http://127.0.0.1:1777;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    access_log /var/log/nginx/memory.91wz.org-access.log;
    error_log /var/log/nginx/memory.91wz.org-error.log;
}
'''
    
    # 写入配置
    cmd = f'''cat > /www/server/panel/vhost/nginx/memory.91wz.org.conf << 'EOF'
{nginx_config}
EOF'''
    stdin, stdout, stderr = ssh.exec_command(cmd)
    stdout.read()
    
    # 测试 Nginx 配置
    stdin, stdout, stderr = ssh.exec_command('nginx -t')
    result = stdout.read().decode()
    err = stderr.read().decode()
    print(f'Nginx test: {result}')
    print(f'Error: {err}')
    
    # 重载 Nginx
    stdin, stdout, stderr = ssh.exec_command('nginx -s reload')
    print(stdout.read().decode())
    
    print('Nginx 配置已更新！')
    ssh.close()
except Exception as e:
    print(f'Error: {e}')
