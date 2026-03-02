#!/usr/bin/env python3
"""
创建PWA图标文件
"""

import paramiko

CONFIG = {
    'host': '134.185.111.25',
    'port': 1022,
    'username': 'root',
    'password': 'C^74+ek@dN',
    'remote_dir': '/home/wwwroot/memory.91wz.org'
}

SVG_CONTENT = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0a0a0f"/>
  <text x="256" y="320" font-family="Arial" font-size="280" font-weight="bold" fill="#3b82f6" text-anchor="middle">7</text>
</svg>'''

def create_icons():
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
        
        # Create icons directory
        try:
            sftp.mkdir(f"{CONFIG['remote_dir']}/web/icons")
        except:
            pass
        
        # Create SVG icon
        svg_path = f"{CONFIG['remote_dir']}/web/icons/icon.svg"
        with sftp.file(svg_path, 'w') as f:
            f.write(SVG_CONTENT)
        print(f"Created: {svg_path}")
        
        # Create PNG placeholders (SVG renamed for compatibility)
        sizes = [72, 96, 128, 144, 152, 192, 384, 512]
        for size in sizes:
            png_path = f"{CONFIG['remote_dir']}/web/icons/icon-{size}.png"
            with sftp.file(png_path, 'w') as f:
                f.write(SVG_CONTENT)
            print(f"Created: icon-{size}.png")
        
        sftp.close()
        print("All PWA icons created!")
        
    finally:
        client.close()

if __name__ == '__main__':
    create_icons()
