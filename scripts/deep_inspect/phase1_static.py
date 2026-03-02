import paramiko
import json

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

results = {
    "phase": 1,
    "name": "并发静态检测",
    "eslint": [],
    "security": [],
    "dependencies": [],
    "code_quality": []
}

try:
    ssh.connect('134.185.111.25', port=1022, username='root', password='C^74+ek@dN', timeout=30)
    print('✅ SSH 连接成功')
    
    # 1. ESLint 检测 (如果有配置)
    print("\n=== 1. ESLint 检测 ===")
    eslint_cmd = '''
    cd /home/wwwroot/memory.91wz.org
    if [ -f .eslintrc.js ] || [ -f .eslintrc.json ]; then
        npx eslint src/ --format json 2>/dev/null || echo "ESLint completed with errors"
    else
        echo "No ESLint config found, checking for obvious issues..."
        # 检查常见问题
        grep -rn "console.log" src/ --include="*.js" | head -20
        grep -rn "var " src/ --include="*.js" | head -10
        grep -rn "==" src/ --include="*.js" | grep -v "===" | head -10
    fi
    '''
    stdin, stdout, stderr = ssh.exec_command(eslint_cmd)
    print(stdout.read().decode())
    
    # 2. 安全漏洞检测
    print("\n=== 2. 安全漏洞检测 ===")
    security_cmd = '''
    cd /home/wwwroot/memory.91wz.org
    echo "--- npm audit ---"
    npm audit --json 2>/dev/null | head -100 || echo "npm audit completed"
    echo ""
    echo "--- 敏感信息检测 ---"
    grep -rn "password.*=.*['\"]" src/ --include="*.js" | grep -v "process.env" | head -10
    grep -rn "api.*key.*=.*['\"]" src/ --include="*.js" | grep -v "process.env" | head -10
    grep -rn "secret.*=.*['\"]" src/ --include="*.js" | grep -v "process.env" | head -10
    '''
    stdin, stdout, stderr = ssh.exec_command(security_cmd)
    print(stdout.read().decode())
    
    # 3. 依赖安全检查
    print("\n=== 3. 依赖安全检查 ===")
    dep_cmd = '''
    cd /home/wwwroot/memory.91wz.org
    echo "--- 过时依赖 ---"
    npm outdated --json 2>/dev/null | head -50 || echo "All dependencies up to date"
    echo ""
    echo "--- 关键依赖版本 ---"
    npm list express mysql2 jsonwebtoken bcryptjs --depth=0 2>/dev/null
    '''
    stdin, stdout, stderr = ssh.exec_command(dep_cmd)
    print(stdout.read().decode())
    
    # 4. 代码质量检测
    print("\n=== 4. 代码质量检测 ===")
    quality_cmd = '''
    cd /home/wwwroot/memory.91wz.org
    echo "--- 代码复杂度 (函数长度) ---"
    find src/ -name "*.js" -exec wc -l {} \; | sort -rn | head -20
    echo ""
    echo "--- 潜在问题 ---"
    echo "未捕获的 Promise:"
    grep -rn "\.then(" src/ --include="*.js" | grep -v "catch" | head -10
    echo ""
    echo "可能的 SQL 注入风险:"
    grep -rn "execute.*+" src/ --include="*.js" | head -10
    grep -rn "query.*+" src/ --include="*.js" | head -10
    echo ""
    echo "可能的 XSS 风险:"
    grep -rn "innerHTML" src/ --include="*.js" | head -10
    grep -rn "eval(" src/ --include="*.js" | head -10
    '''
    stdin, stdout, stderr = ssh.exec_command(quality_cmd)
    print(stdout.read().decode())
    
    # 5. 数据库查询检测
    print("\n=== 5. 数据库查询检测 ===")
    db_cmd = '''
    cd /home/wwwroot/memory.91wz.org
    echo "--- SQL 查询分析 ---"
    grep -rn "SELECT" src/ --include="*.js" | wc -l
    echo "INSERT 查询数:"
    grep -rn "INSERT" src/ --include="*.js" | wc -l
    echo "UPDATE 查询数:"
    grep -rn "UPDATE" src/ --include="*.js" | wc -l
    echo "DELETE 查询数:"
    grep -rn "DELETE" src/ --include="*.js" | wc -l
    echo ""
    echo "--- 参数化查询检查 ---"
    grep -rn "execute(.*\?" src/ --include="*.js" | head -20
    '''
    stdin, stdout, stderr = ssh.exec_command(db_cmd)
    print(stdout.read().decode())
    
    ssh.close()
    print("\n✅ Phase 1 完成")
except Exception as e:
    print(f'❌ Error: {e}')
