#!/usr/bin/env python3
"""
更新健康检查端点添加Redis状态
"""

import paramiko

CONFIG = {
    'host': '134.185.111.25',
    'port': 1022,
    'username': 'root',
    'password': 'C^74+ek@dN',
    'remote_dir': '/home/wwwroot/memory.91wz.org'
}

def update_health():
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
        
        # Add cache import
        if "require('./src/services/CacheService')" not in content:
            content = content.replace(
                "const logger = require('./src/utils/logger');",
                "const logger = require('./src/utils/logger');\nconst cache = require('./src/services/CacheService');"
            )
        
        # Update health endpoint
        old_health = '''app.get('/health', (req, res) => {
    res.json({
        status: 'healthy','''
        
        new_health = '''app.get('/health', async (req, res) => {
    const cacheStatus = await cache.healthCheck();
    res.json({
        status: 'healthy',
        cache: cacheStatus,'''
        
        content = content.replace(old_health, new_health)
        
        with sftp.file(f"{CONFIG['remote_dir']}/server.js", 'w') as f:
            f.write(content.encode('utf-8'))
        
        sftp.close()
        print("Health endpoint updated!")
        
        # Restart PM2
        stdin, stdout, stderr = client.exec_command("pm2 restart 777-ms && sleep 2 && curl -s http://localhost:1777/health")
        output = stdout.read().decode('utf-8')
        print(output)
        
    finally:
        client.close()

if __name__ == '__main__':
    update_health()
