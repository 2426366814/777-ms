#!/usr/bin/env python3
"""
创建亮色主题样式
"""

import paramiko

CONFIG = {
    'host': '134.185.111.25',
    'port': 1022,
    'username': 'root',
    'password': 'C^74+ek@dN',
    'remote_dir': '/home/wwwroot/memory.91wz.org'
}

LIGHT_THEME_CSS = '''
[data-theme="light"] {
    --bg-primary: #f5f5f5;
    --bg-secondary: #ffffff;
    --bg-card: #ffffff;
    --bg-hover: #e5e5e5;
    --text-primary: #1a1a1a;
    --text-secondary: #666666;
    --text-muted: #999999;
    --border-color: #e0e0e0;
    --accent: #2563eb;
    --accent-hover: #1d4ed8;
    --success: #059669;
    --warning: #d97706;
    --error: #dc2626;
}

[data-theme="light"] body {
    background: var(--bg-primary);
    color: var(--text-primary);
}

[data-theme="light"] .sidebar {
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-color);
}

[data-theme="light"] .sidebar .nav-link {
    color: var(--text-secondary);
}

[data-theme="light"] .sidebar .nav-link:hover,
[data-theme="light"] .sidebar .nav-link.active {
    background: var(--bg-hover);
    color: var(--accent);
}

[data-theme="light"] .card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
}

[data-theme="light"] .card-header {
    border-bottom: 1px solid var(--border-color);
}

[data-theme="light"] .table {
    color: var(--text-primary);
}

[data-theme="light"] .table th {
    background: var(--bg-hover);
    border-color: var(--border-color);
}

[data-theme="light"] .table td {
    border-color: var(--border-color);
}

[data-theme="light"] .form-control {
    background: var(--bg-secondary);
    border-color: var(--border-color);
    color: var(--text-primary);
}

[data-theme="light"] .form-control:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

[data-theme="light"] .btn-outline {
    border-color: var(--border-color);
    color: var(--text-primary);
}

[data-theme="light"] .btn-outline:hover {
    background: var(--bg-hover);
}

[data-theme="light"] .modal-content {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
}

[data-theme="light"] .modal-header {
    border-bottom: 1px solid var(--border-color);
}

[data-theme="light"] .modal-footer {
    border-top: 1px solid var(--border-color);
}

[data-theme="light"] .dropdown-menu {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
}

[data-theme="light"] .dropdown-item:hover {
    background: var(--bg-hover);
}

[data-theme="light"] .stat-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
}

[data-theme="light"] .memory-item {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
}

[data-theme="light"] .memory-item:hover {
    border-color: var(--accent);
}

[data-theme="light"] .tag {
    background: var(--bg-hover);
    color: var(--text-primary);
}

[data-theme="light"] .chart-container {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
}

[data-theme="light"] pre, [data-theme="light"] code {
    background: var(--bg-hover);
    color: var(--text-primary);
}

[data-theme="light"] .toast {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

[data-theme="light"] ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

[data-theme="light"] ::-webkit-scrollbar-track {
    background: var(--bg-hover);
}

[data-theme="light"] ::-webkit-scrollbar-thumb {
    background: #ccc;
    border-radius: 4px;
}

[data-theme="light"] ::-webkit-scrollbar-thumb:hover {
    background: #aaa;
}

[data-theme="light"] .theme-toggle-icon {
    transform: rotate(180deg);
}
'''

def create_files():
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
        
        path = f"{CONFIG['remote_dir']}/web/styles-light.css"
        with sftp.file(path, 'w') as f:
            f.write(LIGHT_THEME_CSS)
        print(f"Created: {path}")
        
        sftp.close()
        print("Light theme CSS created successfully!")
        
    finally:
        client.close()

if __name__ == '__main__':
    create_files()
