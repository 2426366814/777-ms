#!/usr/bin/env python3
"""
修复HTML文件中的语法问题
"""

import paramiko

CONFIG = {
    'host': '134.185.111.25',
    'port': 1022,
    'username': 'root',
    'password': 'C^74+ek@dN',
    'remote_dir': '/home/wwwroot/memory.91wz.org'
}

HTML_FILES = [
    'index.html', 'login.html', 'dashboard.html', 'chat.html',
    'intelligence.html', 'review.html', 'visualization.html',
    'providers.html', 'security.html', 'knowledge.html',
    'api.html', 'profile.html', 'admin.html', 'share.html'
]

def fix_html_files():
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
        
        for filename in HTML_FILES:
            filepath = f"{CONFIG['remote_dir']}/web/{filename}"
            try:
                with sftp.file(filepath, 'r') as f:
                    content = f.read().decode('utf-8')
                
                # Fix broken syntax
                content = content.replace(
                    "if (typeof API_BASE ===  undefined) var API_BASE = '/api/v1';",
                    "window.API_BASE = window.API_BASE || '/api/v1';"
                )
                content = content.replace(
                    "if (typeof token === 'undefined') var token = localStorage.getItem('token');",
                    "window.token = window.token || localStorage.getItem('token');"
                )
                content = content.replace(
                    "if (typeof token ===  undefined) var token = localStorage.getItem('token');",
                    "window.token = window.token || localStorage.getItem('token');"
                )
                
                with sftp.file(filepath, 'w') as f:
                    f.write(content.encode('utf-8'))
                
                print(f"Fixed: {filename}")
                
            except Exception as e:
                print(f"Error fixing {filename}: {e}")
        
        sftp.close()
        print("All HTML files fixed!")
        
    finally:
        client.close()

if __name__ == '__main__':
    fix_html_files()
