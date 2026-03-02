import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('✅ SSH 连接成功')
    
    # 数据库检测
    db_cmd = '''
    echo "=== 数据库表列表 ==="
    mysql -u memory_user -p'Memory@2024Secure!' memory -e "SHOW TABLES;"
    
    echo ""
    echo "=== 缺失的表检测 ==="
    echo "检查 pending_extractions 表:"
    mysql -u memory_user -p'Memory@2024Secure!' memory -e "SHOW CREATE TABLE pending_extractions;" 2>&1 || echo "表不存在"
    
    echo ""
    echo "检查 review_items 表:"
    mysql -u memory_user -p'Memory@2024Secure!' memory -e "SHOW CREATE TABLE review_items;" 2>&1 || echo "表不存在"
    
    echo ""
    echo "=== 用户表结构 ==="
    mysql -u memory_user -p'Memory@2024Secure!' memory -e "DESCRIBE users;"
    
    echo ""
    echo "=== 记忆表结构 ==="
    mysql -u memory_user -p'Memory@2024Secure!' memory -e "DESCRIBE memories;"
    
    echo ""
    echo "=== 数据库索引检测 ==="
    mysql -u memory_user -p'Memory@2024Secure!' memory -e "SHOW INDEX FROM users;"
    mysql -u memory_user -p'Memory@2024Secure!' memory -e "SHOW INDEX FROM memories;"
    
    echo ""
    echo "=== 数据库连接池状态 ==="
    mysql -u memory_user -p'Memory@2024Secure!' memory -e "SHOW STATUS LIKE 'Threads%';"
    mysql -u memory_user -p'Memory@2024Secure!' memory -e "SHOW STATUS LIKE 'Connections';"
    '''
    stdin, stdout, stderr = ssh.exec_command(db_cmd)
    print(stdout.read().decode())
    
    ssh.close()
    print("\n✅ Phase 9 完成")
except Exception as e:
    print(f'❌ Error: {e}')
