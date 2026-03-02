#!/usr/bin/env python3
"""
创建数据库迁移文件 (兼容版本)
"""

import paramiko

CONFIG = {
    'host': '134.185.111.25',
    'port': 1022,
    'username': 'root',
    'password': 'C^74+ek@dN',
    'remote_dir': '/home/wwwroot/memory.91wz.org'
}

MIGRATION_SQL = '''
-- v0.5.0 Database Migration
-- Memory Version Control
CREATE TABLE IF NOT EXISTS memory_versions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    memory_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    importance_score DECIMAL(3,2),
    tags TEXT,
    change_reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_versions_memory (memory_id, created_at DESC),
    INDEX idx_versions_user (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Memory Templates
CREATE TABLE IF NOT EXISTS memory_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    fields TEXT NOT NULL,
    is_public TINYINT(1) DEFAULT 0,
    category VARCHAR(50),
    use_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_templates_user (user_id),
    INDEX idx_templates_public (is_public, use_count DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- User Settings
CREATE TABLE IF NOT EXISTS user_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    theme VARCHAR(20) DEFAULT 'dark',
    language VARCHAR(10) DEFAULT 'zh-CN',
    notifications_enabled TINYINT(1) DEFAULT 1,
    shortcuts_enabled TINYINT(1) DEFAULT 1,
    onboarding_completed TINYINT(1) DEFAULT 0,
    custom_settings TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Memory Recommendations Cache
CREATE TABLE IF NOT EXISTS memory_recommendations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    memory_id INT NOT NULL,
    related_memory_id INT NOT NULL,
    similarity_score DECIMAL(5,4),
    recommendation_type VARCHAR(20) DEFAULT 'semantic',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_recommendations_user (user_id, memory_id),
    INDEX idx_recommendations_score (user_id, similarity_score DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Performance Indexes (ignore if exists)
ALTER TABLE memories ADD INDEX idx_memories_user_created (user_id, created_at DESC);
ALTER TABLE memories ADD INDEX idx_memories_user_importance (user_id, importance_score DESC);
ALTER TABLE memories ADD INDEX idx_memories_user_access (user_id, last_accessed_at DESC);
ALTER TABLE knowledge ADD INDEX idx_knowledge_user_category (user_id, category_id);
ALTER TABLE knowledge ADD INDEX idx_knowledge_user_created (user_id, created_at DESC);
ALTER TABLE sessions ADD INDEX idx_sessions_user_created (user_id, created_at DESC);
ALTER TABLE memory_reviews ADD INDEX idx_reviews_user_next (user_id, next_review_at);

-- Insert Default Templates
INSERT IGNORE INTO memory_templates (user_id, name, description, fields, is_public, category) VALUES
(NULL, '会议记录', '用于记录会议内容和决议', '[{"name":"title","label":"会议主题","type":"text","required":true},{"name":"date","label":"会议日期","type":"date","required":true},{"name":"attendees","label":"参会人员","type":"text"},{"name":"agenda","label":"会议议程","type":"textarea"},{"name":"decisions","label":"会议决议","type":"textarea"},{"name":"action_items","label":"待办事项","type":"textarea"}]', 1, 'work'),
(NULL, '学习笔记', '用于记录学习内容和知识点', '[{"name":"title","label":"标题","type":"text","required":true},{"name":"subject","label":"科目","type":"text"},{"name":"key_points","label":"知识点","type":"textarea"},{"name":"understanding","label":"理解程度","type":"select","options":["已掌握","基本理解","需要复习"]},{"name":"notes","label":"详细笔记","type":"textarea"}]', 1, 'study'),
(NULL, '项目计划', '用于记录项目计划和进度', '[{"name":"name","label":"项目名称","type":"text","required":true},{"name":"goal","label":"项目目标","type":"textarea"},{"name":"steps","label":"实施步骤","type":"textarea"},{"name":"deadline","label":"截止日期","type":"date"},{"name":"status","label":"当前状态","type":"select","options":["计划中","进行中","已完成","已暂停"]}]', 1, 'work'),
(NULL, '日记', '用于记录日常生活', '[{"name":"date","label":"日期","type":"date","required":true},{"name":"mood","label":"心情","type":"select","options":["开心","平静","难过","焦虑","兴奋"]},{"name":"content","label":"内容","type":"textarea"},{"name":"tags","label":"标签","type":"text"}]', 1, 'personal'),
(NULL, '代码片段', '用于记录代码和技术笔记', '[{"name":"title","label":"标题","type":"text","required":true},{"name":"language","label":"编程语言","type":"text"},{"name":"code","label":"代码","type":"code"},{"name":"description","label":"说明","type":"textarea"},{"name":"tags","label":"标签","type":"text"}]', 1, 'tech');
'''

def create_migration():
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
        
        migration_dir = f"{CONFIG['remote_dir']}/database/migrations"
        stdin, stdout, stderr = client.exec_command(f"mkdir -p {migration_dir}")
        stdout.read()
        
        migration_path = f"{migration_dir}/003_v0.5.0_enhancements.sql"
        with sftp.file(migration_path, 'w') as f:
            f.write(MIGRATION_SQL)
        print(f"Created: {migration_path}")
        
        sftp.close()
        
        print("Running migration...")
        stdin, stdout, stderr = client.exec_command(f"mysql -u memory -p'ck123456@' memory < {migration_path} 2>&1")
        output = stdout.read().decode('utf-8')
        
        print(output if output else "Migration completed!")
        
    finally:
        client.close()

if __name__ == '__main__':
    create_migration()
