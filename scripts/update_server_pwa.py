#!/usr/bin/env python3
"""
更新server.js添加PWA支持和新功能路由
"""

import paramiko

CONFIG = {
    'host': '134.185.111.25',
    'port': 1022,
    'username': 'root',
    'password': 'C^74+ek@dN',
    'remote_dir': '/home/wwwroot/memory.91wz.org'
}

def update_server():
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
        
        if '/manifest.json' in content:
            print("Server already has PWA routes!")
            sftp.close()
            return
        
        pwa_routes = '''
// PWA Support
app.use('/manifest.json', express.static(path.join(__dirname, 'web/manifest.json')));
app.use('/sw.js', express.static(path.join(__dirname, 'web/sw.js')));
app.use('/icons', express.static(path.join(__dirname, 'web/icons')));
app.use('/js', express.static(path.join(__dirname, 'web/js')));
app.use('/styles-light.css', express.static(path.join(__dirname, 'web/styles-light.css')));

// Version API
app.get('/api/v1/version', (req, res) => {
    res.json({
        version: '0.5.0',
        name: '777-MS Memory System',
        features: ['pwa', 'theme-switch', 'shortcuts', 'i18n', 'notifications', 'onboarding']
    });
});
'''
        
        insert_marker = "app.use(express.static(path.join(__dirname, 'web')));"
        if insert_marker in content:
            content = content.replace(insert_marker, insert_marker + pwa_routes)
        
        with sftp.file(f"{CONFIG['remote_dir']}/server.js", 'w') as f:
            f.write(content.encode('utf-8'))
        
        sftp.close()
        print("Server.js updated with PWA routes!")
        
    finally:
        client.close()

if __name__ == '__main__':
    update_server()
