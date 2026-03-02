#!/usr/bin/env python3
"""
更新HTML文件添加PWA支持
"""

import paramiko

CONFIG = {
    'host': '134.185.111.25',
    'port': 1022,
    'username': 'root',
    'password': 'C^74+ek@dN',
    'remote_dir': '/home/wwwroot/memory.91wz.org'
}

PWA_HEAD = '''
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#0a0a0f">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="777-MS">
    <link rel="apple-touch-icon" href="/icons/icon-192.png">
    <link rel="stylesheet" href="/styles-light.css">
'''

PWA_SCRIPTS = '''
    <script src="/js/common.js"></script>
    <script src="/js/theme.js"></script>
    <script src="/js/shortcuts.js"></script>
    <script src="/js/i18n.js"></script>
    <script src="/js/notifications.js"></script>
    <script>
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('SW registered:', reg.scope))
                .catch(err => console.log('SW registration failed:', err));
        });
    }
    </script>
'''

HTML_FILES = [
    'index.html', 'login.html', 'dashboard.html', 'chat.html',
    'intelligence.html', 'review.html', 'visualization.html',
    'providers.html', 'security.html', 'knowledge.html',
    'api.html', 'profile.html', 'admin.html', 'share.html'
]

def update_html_files():
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
                
                if 'manifest.json' in content:
                    print(f"Skip {filename} - already has PWA")
                    continue
                
                if '</head>' in content:
                    content = content.replace('</head>', PWA_HEAD + '</head>')
                
                if '</body>' in content:
                    content = content.replace('</body>', PWA_SCRIPTS + '</body>')
                
                with sftp.file(filepath, 'w') as f:
                    f.write(content.encode('utf-8'))
                
                print(f"Updated: {filename}")
                
            except Exception as e:
                print(f"Error updating {filename}: {e}")
        
        sftp.close()
        print("All HTML files updated!")
        
    finally:
        client.close()

if __name__ == '__main__':
    update_html_files()
