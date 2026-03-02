#!/usr/bin/env python3
import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('134.185.111.25', 1022, 'root', 'C^74+ek@dN')

# 检查数据库结构
stdin, stdout, stderr = client.exec_command("mysql -u memory -p'ck123456@' memory -e 'DESCRIBE memories;'")
out = stdout.read().decode()
err = stderr.read().decode()
print("=== memories table structure ===")
print(out)
if err:
    print("Error:", err)

stdin, stdout, stderr = client.exec_command("mysql -u memory -p'ck123456@' memory -e 'SELECT id, LEFT(content,30) as content FROM memories LIMIT 5;'")
out = stdout.read().decode()
err = stderr.read().decode()
print("=== memories data ===")
print(out)
if err:
    print("Error:", err)

client.close()
