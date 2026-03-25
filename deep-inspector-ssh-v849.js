/**
 * Deep Inspector v8.49 - SSH/OpenSSH 完整检测脚本
 * 777-MS Memory System - 使用系统 OpenSSH
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const http = require('http');
const https = require('https');

// 检测配置
const CONFIG = {
    version: '8.49',
    project: '777-MS Memory System',
    localUrl: 'http://localhost:1777',
    remoteSsh: 'root@43.167.167.211',
    remotePort: 1022,
    remoteUrl: 'https://memory.91wz.org',
    sshKeyPath: 'C:\\Users\\Administrator\\.ssh\\id_rsa',
    screenshotDir: path.join(__dirname, 'reports', 'screenshots', `v849_ssh_${Date.now()}`),
    reportDir: path.join(__dirname, 'reports')
};

// 检测结果存储
const results = {
    startTime: new Date().toISOString(),
    phases: {},
    errors: [],
    warnings: [],
    screenshots: [],
    sshTests: {}
};

// 日志函数
function log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, data };
    
    if (level === 'ERROR') {
        results.errors.push(logEntry);
        console.error(`[${timestamp}] [ERROR] ${message}`);
    } else if (level === 'WARN') {
        results.warnings.push(logEntry);
        console.warn(`[${timestamp}] [WARN] ${message}`);
    } else {
        console.log(`[${timestamp}] [${level}] ${message}`);
    }
    
    return logEntry;
}

// 确保目录存在
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        log('INFO', `Created directory: ${dir}`);
    }
}

// ==================== Phase 6: 远程服务器测试 (OpenSSH) ====================
async function phase6_RemoteServerTest() {
    log('INFO', '========================================');
    log('INFO', 'Phase 6: 远程服务器测试 (OpenSSH)');
    log('INFO', '========================================');
    
    const phaseResults = { 
        status: 'running', 
        tests: [],
        ssh: {},
        server: {}
    };
    
    try {
        // 1. 检查 OpenSSH 安装
        log('INFO', 'Checking OpenSSH installation...');
        try {
            const sshVersion = execSync('C:\\Windows\\System32\\OpenSSH\\ssh.exe -V 2>&1', { encoding: 'utf8' });
            phaseResults.ssh.version = sshVersion.trim();
            log('INFO', `✅ OpenSSH: ${sshVersion.trim()}`);
        } catch (e) {
            log('WARN', `⚠️ OpenSSH check: ${e.message}`);
        }
        
        // 2. 检查 SSH 密钥
        log('INFO', 'Checking SSH keys...');
        const sshKeyPath = CONFIG.sshKeyPath;
        if (fs.existsSync(sshKeyPath)) {
            const stats = fs.statSync(sshKeyPath);
            phaseResults.ssh.keyExists = true;
            phaseResults.ssh.keySize = stats.size;
            log('INFO', `✅ SSH key found: ${sshKeyPath} (${stats.size} bytes)`);
        } else {
            phaseResults.ssh.keyExists = false;
            log('WARN', `⚠️ SSH key not found: ${sshKeyPath}`);
        }
        
        // 3. 检查 SSH 配置
        const sshConfigPath = 'C:\\Users\\Administrator\\.ssh\\config';
        if (fs.existsSync(sshConfigPath)) {
            const config = fs.readFileSync(sshConfigPath, 'utf8');
            phaseResults.ssh.hasConfig = true;
            log('INFO', '✅ SSH config found');
            
            // 解析配置中的主机
            const hostMatches = config.match(/Host\s+(\S+)/g);
            if (hostMatches) {
                phaseResults.ssh.configuredHosts = hostMatches.map(h => h.replace('Host ', ''));
                log('INFO', `📋 Configured hosts: ${phaseResults.ssh.configuredHosts.join(', ')}`);
            }
        }
        
        // 4. 测试 SSH 连接 (使用密钥)
        log('INFO', `Testing SSH connection to ${CONFIG.remoteSsh}:${CONFIG.remotePort}...`);
        try {
            // 使用 ssh-keyscan 检查服务器
            const keyscanResult = execSync(
                `C:\\Windows\\System32\\OpenSSH\\ssh-keyscan.exe -p ${CONFIG.remotePort} -H ${CONFIG.remoteSsh} 2>&1 | head -3`,
                { encoding: 'utf8', timeout: 10000 }
            );
            if (keyscanResult.includes('ssh-')) {
                phaseResults.ssh.serverReachable = true;
                log('INFO', '✅ SSH server is reachable');
            }
        } catch (e) {
            phaseResults.ssh.serverReachable = false;
            log('WARN', `⚠️ SSH server check: ${e.message}`);
        }
        
        // 5. 尝试 SSH 连接并执行命令
        try {
            const sshResult = execSync(
                `C:\\Windows\\System32\\OpenSSH\\ssh.exe -p ${CONFIG.remotePort} -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o BatchMode=yes -i "${CONFIG.sshKeyPath}" ${CONFIG.remoteSsh} "echo 'SSH_OK'; hostname; uptime"`,
                { encoding: 'utf8', timeout: 15000 }
            );
            
            phaseResults.ssh.connectionSuccess = true;
            phaseResults.ssh.serverInfo = sshResult.trim();
            log('INFO', '✅ SSH connection successful!');
            log('INFO', `Server info:\n${sshResult}`);
            
            // 检查远程服务器上的项目
            try {
                const projectCheck = execSync(
                    `C:\\Windows\\System32\\OpenSSH\\ssh.exe -p ${CONFIG.remotePort} -o StrictHostKeyChecking=no -o BatchMode=yes -i "${CONFIG.sshKeyPath}" ${CONFIG.remoteSsh} "ls -la /opt/777-ms/ 2>/dev/null || ls -la /root/777-ms/ 2>/dev/null || echo 'Project not found in standard locations'"`,
                    { encoding: 'utf8', timeout: 10000 }
                );
                phaseResults.server.projectPath = projectCheck.trim();
                log('INFO', `Remote project check:\n${projectCheck}`);
            } catch (e) {
                log('WARN', `Project check: ${e.message}`);
            }
            
            // 检查远程服务状态
            try {
                const serviceStatus = execSync(
                    `C:\\Windows\\System32\\OpenSSH\\ssh.exe -p ${CONFIG.remotePort} -o StrictHostKeyChecking=no -o BatchMode=yes -i "${CONFIG.sshKeyPath}" ${CONFIG.remoteSsh} "systemctl status 777-ms 2>/dev/null || pm2 status 2>/dev/null || docker ps 2>/dev/null || echo 'No service manager found'"`,
                    { encoding: 'utf8', timeout: 10000 }
                );
                phaseResults.server.serviceStatus = serviceStatus.trim();
                log('INFO', `Service status:\n${serviceStatus}`);
            } catch (e) {
                log('WARN', `Service check: ${e.message}`);
            }
            
        } catch (e) {
            phaseResults.ssh.connectionSuccess = false;
            phaseResults.ssh.connectionError = e.message;
            log('WARN', `⚠️ SSH connection failed: ${e.message}`);
            log('INFO', '💡 Tip: SSH key may need password or key not authorized on server');
        }
        
        // 6. 测试远程 HTTP/HTTPS
        log('INFO', `Testing remote HTTP access to ${CONFIG.remoteUrl}...`);
        const remoteHealthCheck = await new Promise((resolve) => {
            const req = https.get(CONFIG.remoteUrl, { timeout: 10000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({ 
                        success: res.statusCode === 200 || res.statusCode === 301 || res.statusCode === 302, 
                        status: res.statusCode,
                        data: data.substring(0, 200)
                    });
                });
            });
            req.on('error', (err) => resolve({ success: false, error: err.message }));
            req.on('timeout', () => {
                req.destroy();
                resolve({ success: false, error: 'Timeout' });
            });
        });
        
        if (remoteHealthCheck.success) {
            phaseResults.server.httpAccessible = true;
            phaseResults.server.httpStatus = remoteHealthCheck.status;
            log('INFO', `✅ Remote HTTPS accessible (status: ${remoteHealthCheck.status})`);
        } else {
            phaseResults.server.httpAccessible = false;
            phaseResults.server.httpError = remoteHealthCheck.error;
            log('WARN', `⚠️ Remote HTTPS not accessible: ${remoteHealthCheck.error}`);
        }
        
        // 7. 检查远程 API
        log('INFO', 'Testing remote API endpoints...');
        const apiCheck = await new Promise((resolve) => {
            const req = https.get(`${CONFIG.remoteUrl}/health`, { timeout: 10000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve({ success: true, status: res.statusCode, data: json });
                    } catch (e) {
                        resolve({ success: false, error: 'Invalid JSON' });
                    }
                });
            });
            req.on('error', (err) => resolve({ success: false, error: err.message }));
            req.on('timeout', () => {
                req.destroy();
                resolve({ success: false, error: 'Timeout' });
            });
        });
        
        if (apiCheck.success) {
            phaseResults.server.apiAccessible = true;
            phaseResults.server.healthData = apiCheck.data;
            log('INFO', `✅ Remote API health check: ${JSON.stringify(apiCheck.data)}`);
        } else {
            phaseResults.server.apiAccessible = false;
            log('WARN', `⚠️ Remote API not accessible: ${apiCheck.error}`);
        }
        
        phaseResults.status = 'completed';
        log('INFO', '✅ Phase 6 completed');
    } catch (error) {
        phaseResults.status = 'error';
        phaseResults.error = error.message;
        log('ERROR', `Phase 6 failed: ${error.message}`);
    }
    
    results.phases['6'] = phaseResults;
    results.sshTests = phaseResults;
    return phaseResults;
}

// ==================== 生成报告 ====================
function generateReport() {
    log('INFO', '========================================');
    log('INFO', 'Generating SSH Test Report');
    log('INFO', '========================================');
    
    results.endTime = new Date().toISOString();
    results.duration = new Date(results.endTime) - new Date(results.startTime);
    
    // 生成 JSON 报告
    const reportPath = path.join(CONFIG.reportDir, `DEEP_INSPECTION_SSH_V${CONFIG.version}_REPORT.json`);
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    log('INFO', `📄 JSON Report: ${reportPath}`);
    
    // 生成 Markdown 报告
    const mdReport = generateMarkdownReport();
    const mdPath = path.join(CONFIG.reportDir, `DEEP_INSPECTION_SSH_V${CONFIG.version}_REPORT.md`);
    fs.writeFileSync(mdPath, mdReport);
    log('INFO', `📄 Markdown Report: ${mdPath}`);
    
    return { json: reportPath, markdown: mdPath };
}

// 生成 Markdown 报告
function generateMarkdownReport() {
    let md = `# Deep Inspector v${CONFIG.version} SSH/OpenSSH 检测报告\n\n`;
    md += `**项目**: ${CONFIG.project}\n\n`;
    md += `**检测时间**: ${results.startTime}\n\n`;
    md += `**耗时**: ${(results.duration / 1000).toFixed(2)} 秒\n\n`;
    md += `---\n\n`;
    
    // SSH 测试结果
    const sshResults = results.sshTests;
    md += `## SSH/OpenSSH 检测结果\n\n`;
    
    if (sshResults.ssh) {
        md += `### OpenSSH 信息\n\n`;
        md += `- 版本: ${sshResults.ssh.version || 'N/A'}\n`;
        md += `- 密钥存在: ${sshResults.ssh.keyExists ? '✅' : '❌'}\n`;
        if (sshResults.ssh.keySize) {
            md += `- 密钥大小: ${sshResults.ssh.keySize} bytes\n`;
        }
        md += `- 配置文件: ${sshResults.ssh.hasConfig ? '✅' : '❌'}\n`;
        if (sshResults.ssh.configuredHosts) {
            md += `- 配置的主机: ${sshResults.ssh.configuredHosts.join(', ')}\n`;
        }
        md += `\n`;
        
        md += `### 连接测试\n\n`;
        md += `- 服务器可达: ${sshResults.ssh.serverReachable ? '✅' : '❌'}\n`;
        md += `- 连接成功: ${sshResults.ssh.connectionSuccess ? '✅' : '❌'}\n`;
        if (sshResults.ssh.connectionError) {
            md += `- 连接错误: ${sshResults.ssh.connectionError}\n`;
        }
        md += `\n`;
    }
    
    if (sshResults.server) {
        md += `### 远程服务器状态\n\n`;
        md += `- HTTP 可访问: ${sshResults.server.httpAccessible ? '✅' : '❌'}\n`;
        if (sshResults.server.httpStatus) {
            md += `- HTTP 状态码: ${sshResults.server.httpStatus}\n`;
        }
        md += `- API 可访问: ${sshResults.server.apiAccessible ? '✅' : '❌'}\n`;
        md += `\n`;
        
        if (sshResults.server.healthData) {
            md += `### 健康检查数据\n\n`;
            md += `\`\`\`json\n${JSON.stringify(sshResults.server.healthData, null, 2)}\n\`\`\`\n\n`;
        }
        
        if (sshResults.server.serviceStatus) {
            md += `### 服务状态\n\n`;
            md += `\`\`\`\n${sshResults.server.serviceStatus}\n\`\`\`\n\n`;
        }
    }
    
    // 错误和警告
    if (results.errors.length > 0) {
        md += `## 错误\n\n`;
        for (const error of results.errors) {
            md += `- ❌ ${error.message}\n`;
        }
        md += `\n`;
    }
    
    if (results.warnings.length > 0) {
        md += `## 警告\n\n`;
        for (const warning of results.warnings) {
            md += `- ⚠️ ${warning.message}\n`;
        }
        md += `\n`;
    }
    
    md += `---\n\n`;
    md += `*Generated by Deep Inspector v${CONFIG.version}*\n`;
    
    return md;
}

// ==================== 主函数 ====================
async function main() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║     Deep Inspector v${CONFIG.version} - SSH/OpenSSH 检测             ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
    
    try {
        // 执行 Phase 6 SSH 测试
        await phase6_RemoteServerTest();
        
        // 生成报告
        const reports = generateReport();
        
        const sshResults = results.sshTests;
        
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║              SSH/OpenSSH 检测完成 ✅                          ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

📊 检测结果:
   - OpenSSH: ${sshResults.ssh?.version || 'N/A'}
   - SSH Key: ${sshResults.ssh?.keyExists ? '✅' : '❌'}
   - Server Reachable: ${sshResults.ssh?.serverReachable ? '✅' : '❌'}
   - Connection Success: ${sshResults.ssh?.connectionSuccess ? '✅' : '❌'}
   - HTTP Accessible: ${sshResults.server?.httpAccessible ? '✅' : '❌'}
   - API Accessible: ${sshResults.server?.apiAccessible ? '✅' : '❌'}

📁 报告位置:
   - JSON: ${reports.json}
   - Markdown: ${reports.markdown}

❌ 错误: ${results.errors.length}
⚠️ 警告: ${results.warnings.length}
`);
        
    } catch (error) {
        log('ERROR', `SSH Inspection failed: ${error.message}`);
        console.error(error);
        process.exit(1);
    }
}

// 运行检测
main().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
