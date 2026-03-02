import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('✅ SSH 连接成功')
    
    # 创建缺失的表
    create_tables = '''
    echo "=== 创建 pending_extractions 表 ==="
    mysql -u memory_user -p'Memory@2024Secure!' memory << 'EOF'
    CREATE TABLE IF NOT EXISTS pending_extractions (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        content TEXT NOT NULL,
        status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status_created (status,    );
    EOF'
    
    echo ""
    echo "=== 创建 review_items 表 ==="
    mysql -u memory_user -p'Memory@2024Secure!' memory << 'EOF'
    CREATE TABLE IF NOT EXISTS review_items (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        memory_id VARCHAR(36) NOT NULL,
        next_review_at TIMESTAMP,
        interval_days INT DEFAULT 1,
        ease_factor FLOAT DEFAULT 2.0,
        status ENUM('pending', 'completed', 'skipped') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
        INDEX idx_user_memory (user_id, memory_id)
    );
    EOF'
    '''
    stdin, stdout, stderr = ssh.exec_command(create_tables)
    result = stdout.read().decode()
    print(result)
    
    # 验证表是否创建
    verify_cmd = "mysql -u memory_user -p'Memory@2024Secure!' memory -e \"SHOW TABLES LIKE 'pending%tractions' OR SHOW TABLES LIKE 'review_items';\""
    stdin, stdout, stderr = ssh.exec_command(verify_cmd)
    print(stdout.read().decode())
    
    ssh.close()
    print("\n✅ 表创建完成")
except Exception as e:
    print(f'❌ Error: {e}')
