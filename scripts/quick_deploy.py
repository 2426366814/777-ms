#!/usr/bin/env python3
import os
import sys
import paramiko
import scp

CONFIG = {
    'host': '134.185.111.25',
    'port': 1022,
    'username': 'root',
    'password': 'C^74+ek@dN',
    'remote_dir': '/home/wwwroot/memory.91wz.org',
}

def deploy_files():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    print(f"Connecting to {CONFIG['host']}:{CONFIG['port']}...")
    client.connect(
        hostname=CONFIG['host'],
        port=CONFIG['port'],
        username=CONFIG['username'],
        password=CONFIG['password'],
        timeout=30
    )
    print("Connected!")
    
    files = [
        ('src/models/User.js', 'src/models/User.js'),
        ('src/routes/user.js', 'src/routes/user.js'),
    ]
    
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    with scp.SCPClient(client.get_transport()) as scp_client:
        for local_rel, remote_rel in files:
            local_path = os.path.join(project_root, local_rel)
            remote_path = f"{CONFIG['remote_dir']}/{remote_rel}"
            print(f"Uploading: {local_path} -> {remote_path}")
            scp_client.put(local_path, remote_path)
            print(f"Done: {remote_path}")
    
    # Restart PM2
    print("Restarting PM2...")
    stdin, stdout, stderr = client.exec_command('cd /home/wwwroot/memory.91wz.org && pm2 restart 777-ms')
    print(stdout.read().decode())
    print(stderr.read().decode())
    
    client.close()
    print("All files deployed and service restarted!")

if __name__ == '__main__':
    deploy_files()
