import paramiko
import os
import sys

config = {
    'hostname': '134.185.111.25',
    'port': 1022,
    'username': 'root',
    'password': 'C^74+ek@dN',
    'timeout': 60,
    'banner_timeout': 60
}

files = [
    'admin.html',
    'dashboard.html', 
    'security.html',
    'review.html',
    'knowledge.html',
    'providers.html',
    'profile.html',
    'visualization.html',
    'intelligence.html'
]

local_dir = os.path.join(os.path.dirname(__file__), 'web')
remote_dir = '/home/wwwroot/memory.91wz.org/web'

print('Connecting to SSH...')
print(f'Server: {config["hostname"]}:{config["port"]}')

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(**config)
    print('SSH connected!')
    
    sftp = client.open_sftp()
    print('SFTP opened!')
    
    for file in files:
        local_path = os.path.join(local_dir, file)
        remote_path = f'{remote_dir}/{file}'
        print(f'Uploading {file}...')
        try:
            sftp.put(local_path, remote_path)
            print(f'  Uploaded {file}')
        except Exception as e:
            print(f'  Failed: {e}')
    
    sftp.close()
    client.close()
    print('Deployment complete!')
    
except Exception as e:
    print(f'Error: {e}')
    sys.exit(1)
