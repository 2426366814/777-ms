#!/usr/bin/env python3
import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('134.185.111.25', 1022, 'root', 'C^74+ek@dN')

stdin, stdout, stderr = client.exec_command("grep -A5 'INSERT INTO memories' /home/wwwroot/memory.91wz.org/src/services/MemoryService.js")
print(stdout.read().decode())

client.close()
