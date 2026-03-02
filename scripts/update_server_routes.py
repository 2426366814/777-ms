#!/usr/bin/env python3
"""
更新server.js添加新API路由
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
        
        # Check if routes already exist
        if 'templates.js' in content:
            print("Routes already exist in server.js!")
            sftp.close()
            return
        
        # Add new route imports
        route_imports = '''
const templatesRouter = require('./src/routes/templates');
const versionsRouter = require('./src/routes/versions');
const batchRouter = require('./src/routes/batch');
const settingsRouter = require('./src/routes/settings');
'''
        
        # Find a good place to add imports (after other require statements)
        if "const userRouter" in content:
            content = content.replace(
                "const userRouter = require('./src/routes/user');",
                "const userRouter = require('./src/routes/user');\n" + route_imports
            )
        elif "require('./src/routes" in content:
            # Add after last require
            last_require = content.rfind("require('./src/routes")
            end_of_line = content.find('\n', last_require)
            content = content[:end_of_line] + '\n' + route_imports + content[end_of_line:]
        
        # Add new route registrations
        route_regs = '''
// v0.5.0 New Routes
app.use('/api/v1/templates', templatesRouter);
app.use('/api/v1', versionsRouter);
app.use('/api/v1', batchRouter);
app.use('/api/v1/settings', settingsRouter);
'''
        
        # Find a good place to add routes (after other app.use statements)
        if "app.use('/api/v1/memories'" in content:
            content = content.replace(
                "app.use('/api/v1/memories', memoryRouter);",
                "app.use('/api/v1/memories', memoryRouter);\n" + route_regs
            )
        elif "app.use('/api/v1" in content:
            last_route = content.rfind("app.use('/api/v1")
            end_of_line = content.find('\n', last_route)
            content = content[:end_of_line] + '\n' + route_regs + content[end_of_line:]
        
        with sftp.file(f"{CONFIG['remote_dir']}/server.js", 'w') as f:
            f.write(content.encode('utf-8'))
        
        sftp.close()
        print("Server.js updated with new routes!")
        
    finally:
        client.close()

if __name__ == '__main__':
    update_server()
