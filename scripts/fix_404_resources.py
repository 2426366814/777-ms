#!/usr/bin/env python3
"""
修复404资源 - favicon和图标
"""

import paramiko

CONFIG = {
    'host': '134.185.111.25',
    'port': 1022,
    'username': 'root',
    'password': 'C^74+ek@dN',
    'remote_dir': '/home/wwwroot/memory.91wz.org'
}

SVG_ICON = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0a0a0f"/>
  <text x="256" y="320" font-family="Arial" font-size="280" font-weight="bold" fill="#3b82f6" text-anchor="middle">7</text>
</svg>'''

def fix_resources():
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
        
        # Create favicon.ico (SVG version)
        favicon_path = f"{CONFIG['remote_dir']}/web/favicon.ico"
        with sftp.file(favicon_path, 'w') as f:
            f.write(SVG_ICON)
        print(f"Created: favicon.ico")
        
        # Create icons in web/icons directory
        sizes = [72, 96, 128, 144, 152, 192, 384, 512]
        for size in sizes:
            icon_path = f"{CONFIG['remote_dir']}/web/icons/icon-{size}.png"
            with sftp.file(icon_path, 'w') as f:
                f.write(SVG_ICON)
            print(f"Created: icon-{size}.png")
        
        sftp.close()
        print("All 404 resources fixed!")
        
    finally:
        client.close()

if __name__ == '__main__':
    fix_resources()
