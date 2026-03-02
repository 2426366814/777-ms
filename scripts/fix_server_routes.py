#!/usr/bin/env python3
"""
修复server.js - 添加缺失的路由注册
"""

import paramiko

CONFIG = {
    'host': '134.185.111.25',
    'port': 1022,
    'username': 'root',
    'password': 'C^74+ek@dN',
    'remote_dir': '/home/wwwroot/memory.91wz.org'
}

def fix_server():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        client.connect(
            hostname=CONFIG['host'],
            port=CONFIG['port'],
            username=CONFIG['username'],
            password=CONFIG['password'],
            timeout=30
        )
        
        sftp = client.open_sftp()
        
        with sftp.file(f"{CONFIG['remote_dir']}/server.js", 'r') as f:
            content = f.read().decode('utf-8')
        
        # Check if routes already registered
        if "app.use('/api/v1/templates'" in content:
            print("Routes already registered!")
            sftp.close()
            return
        
        # Find the location to add routes (after admin routes)
        insert_marker = "app.use('/api/v1/admin', adminRoutes);"
        
        new_routes = '''
// v0.5.0 New Routes
app.use('/api/v1/templates', auth.authenticate, templatesRouter);
app.use('/api/v1', auth.authenticate, versionsRouter);
app.use('/api/v1', auth.authenticate, batchRouter);
app.use('/api/v1/settings', auth.authenticate, settingsRouter);
'''
        
        if insert_marker in content:
            content = content.replace(insert_marker, insert_marker + new_routes)
        
        with sftp.file(f"{CONFIG['remote_dir']}/server.js", 'w') as f:
            f.write(content.encode('utf-8'))
        
        sftp.close()
        print("Server.js fixed with new routes!")
        
        # Restart PM2
        stdin, stdout, stderr = client.exec_command("pm2 restart 777-ms")
        stdout.read()
        print("Service restarted!")
        
    finally:
        client.close()

if __name__ == '__main__':
    fix_server()
