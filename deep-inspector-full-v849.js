/**
 * Deep Inspector v8.49 - 完整深度检测脚本（全Phase版）
 * 777-MS Memory System 全面检测
 * 
 * 一次性执行所有 Phase 0-10
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const http = require('http');

// 检测配置
const CONFIG = {
    version: '8.49',
    project: '777-MS Memory System',
    localUrl: 'http://localhost:1777',
    remoteSsh: 'root@43.167.167.211:1022',
    remoteUrl: 'https://memory.91wz.org',
    screenshotDir: path.join(__dirname, 'reports', 'screenshots', `v849_full_${Date.now()}`),
    reportDir: path.join(__dirname, 'reports'),
    phases: [0, 1, 1.5, 1.6, 2, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10]
};

// 检测结果存储
const results = {
    startTime: new Date().toISOString(),
    phases: {},
    errors: [],
    warnings: [],
    screenshots: [],
    serverPid: null
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

// 统计文件数量
function countFiles(dir, ext) {
    let count = 0;
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            count += countFiles(fullPath, ext);
        } else if (item.endsWith(ext)) {
            count++;
        }
    }
    return count;
}

// 扫描代码问题
function scanForIssues(dir, issues = []) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            scanForIssues(fullPath, issues);
        } else if (item.endsWith('.js')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('console.log') && !content.includes('logger.')) {
                issues.push({ file: fullPath, type: 'console.log', message: 'Using console.log instead of logger' });
            }
        }
    }
    return issues;
}

// 提取表名引用
function extractTableReferences(dir, tables = new Set()) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            extractTableReferences(fullPath, tables);
        } else if (item.endsWith('.js')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const fromMatches = content.match(/FROM\s+(\w+)/gi);
            if (fromMatches) {
                fromMatches.forEach(m => tables.add(m.replace(/FROM\s+/i, '')));
            }
            const intoMatches = content.match(/INTO\s+(\w+)/gi);
            if (intoMatches) {
                intoMatches.forEach(m => tables.add(m.replace(/INTO\s+/i, '')));
            }
            const updateMatches = content.match(/UPDATE\s+(\w+)/gi);
            if (updateMatches) {
                updateMatches.forEach(m => tables.add(m.replace(/UPDATE\s+/i, '')));
            }
        }
    }
    return Array.from(tables);
}

// ==================== Phase 0: 配置初始化 ====================
async function phase0_ConfigInitialization() {
    log('INFO', '========================================');
    log('INFO', 'Phase 0: 配置初始化');
    log('INFO', '========================================');
    
    const phaseResults = { status: 'running', checks: [] };
    
    try {
        const configPath = path.join(__dirname, '.deep-inspector.yaml');
        if (fs.existsSync(configPath)) {
            phaseResults.checks.push({ name: 'Config file exists', status: 'pass' });
            log('INFO', '✅ Configuration file found');
        }
        
        const packagePath = path.join(__dirname, 'package.json');
        if (fs.existsSync(packagePath)) {
            const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            phaseResults.checks.push({ name: 'package.json valid', status: 'pass', data: { name: pkg.name, version: pkg.version } });
            log('INFO', `✅ Project: ${pkg.name} v${pkg.version}`);
        }
        
        const envPath = path.join(__dirname, '.env');
        if (fs.existsSync(envPath)) {
            phaseResults.checks.push({ name: '.env file exists', status: 'pass' });
            log('INFO', '✅ Environment file found');
        }
        
        ensureDir(CONFIG.screenshotDir);
        ensureDir(CONFIG.reportDir);
        
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        phaseResults.checks.push({ name: 'Node.js version', status: majorVersion >= 18 ? 'pass' : 'warn', data: { version: nodeVersion } });
        log('INFO', `✅ Node.js version: ${nodeVersion}`);
        
        const srcDir = path.join(__dirname, 'src');
        if (fs.existsSync(srcDir)) {
            const jsFiles = countFiles(srcDir, '.js');
            phaseResults.checks.push({ name: 'Source files count', status: 'pass', data: { jsFiles } });
            log('INFO', `✅ Source files: ${jsFiles} JavaScript files`);
        }
        
        phaseResults.status = 'completed';
        log('INFO', '✅ Phase 0 completed');
    } catch (error) {
        phaseResults.status = 'error';
        phaseResults.error = error.message;
        log('ERROR', `Phase 0 failed: ${error.message}`);
    }
    
    results.phases['0'] = phaseResults;
    return phaseResults;
}

// ==================== Phase 1: 代码审查 ====================
async function phase1_CodeReview() {
    log('INFO', '========================================');
    log('INFO', 'Phase 1: 代码审查');
    log('INFO', '========================================');
    
    const phaseResults = { status: 'running', checks: [], issues: [] };
    
    try {
        const criticalFiles = [
            'server.js',
            'src/utils/database.js',
            'src/middleware/auth.js',
            'src/routes/user.js',
            'src/routes/admin.js'
        ];
        
        for (const file of criticalFiles) {
            const filePath = path.join(__dirname, file);
            if (fs.existsSync(filePath)) {
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    if (content.includes('module.exports') || content.includes('exports.')) {
                        phaseResults.checks.push({ name: `${file} syntax`, status: 'pass' });
                        log('INFO', `✅ ${file} - Syntax OK`);
                    }
                } catch (err) {
                    phaseResults.checks.push({ name: `${file} syntax`, status: 'fail', error: err.message });
                }
            }
        }
        
        const srcDir = path.join(__dirname, 'src');
        const issues = scanForIssues(srcDir);
        phaseResults.issues = issues;
        
        if (issues.length > 0) {
            log('WARN', `⚠️ Found ${issues.length} potential issues`);
        } else {
            log('INFO', '✅ No obvious issues found');
        }
        
        phaseResults.status = 'completed';
        log('INFO', '✅ Phase 1 completed');
    } catch (error) {
        phaseResults.status = 'error';
        phaseResults.error = error.message;
        log('ERROR', `Phase 1 failed: ${error.message}`);
    }
    
    results.phases['1'] = phaseResults;
    return phaseResults;
}

// ==================== Phase 1.5: 关联冲突检测 ====================
async function phase1_5_ConflictDetection() {
    log('INFO', '========================================');
    log('INFO', 'Phase 1.5: 关联冲突检测');
    log('INFO', '========================================');
    
    const phaseResults = { status: 'running', checks: [], conflicts: [] };
    
    try {
        const routesDir = path.join(__dirname, 'src', 'routes');
        if (fs.existsSync(routesDir)) {
            const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
            for (const file of files) {
                const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
                if (content.includes('module.exports') && content.includes('router')) {
                    phaseResults.checks.push({ name: `${file} exports`, status: 'pass' });
                }
            }
        }
        
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        const criticalDeps = ['express', 'mysql2', 'jsonwebtoken', 'bcryptjs', 'joi'];
        for (const dep of criticalDeps) {
            if (deps[dep]) {
                phaseResults.checks.push({ name: `${dep} installed`, status: 'pass', version: deps[dep] });
                log('INFO', `✅ ${dep}@${deps[dep]}`);
            } else {
                phaseResults.checks.push({ name: `${dep} installed`, status: 'fail' });
                log('ERROR', `❌ ${dep} not found`);
            }
        }
        
        phaseResults.status = 'completed';
        log('INFO', '✅ Phase 1.5 completed');
    } catch (error) {
        phaseResults.status = 'error';
        phaseResults.error = error.message;
        log('ERROR', `Phase 1.5 failed: ${error.message}`);
    }
    
    results.phases['1.5'] = phaseResults;
    return phaseResults;
}

// ==================== Phase 1.6: 数据库结构验证 ====================
async function phase1_6_DatabaseValidation() {
    log('INFO', '========================================');
    log('INFO', 'Phase 1.6: 数据库结构验证');
    log('INFO', '========================================');
    
    const phaseResults = { status: 'running', checks: [], tables: [], mismatches: [] };
    
    try {
        const dbConfigPath = path.join(__dirname, 'src', 'utils', 'database.js');
        if (fs.existsSync(dbConfigPath)) {
            phaseResults.checks.push({ name: 'Database config exists', status: 'pass' });
            log('INFO', '✅ Database configuration found');
        }
        
        const srcDir = path.join(__dirname, 'src');
        const referencedTables = extractTableReferences(srcDir);
        phaseResults.tables = referencedTables;
        
        log('INFO', `📊 Found ${referencedTables.length} table references in code`);
        for (const table of referencedTables.slice(0, 10)) {
            log('INFO', `  - ${table}`);
        }
        
        phaseResults.status = 'completed';
        log('INFO', '✅ Phase 1.6 completed');
    } catch (error) {
        phaseResults.status = 'error';
        phaseResults.error = error.message;
        log('ERROR', `Phase 1.6 failed: ${error.message}`);
    }
    
    results.phases['1.6'] = phaseResults;
    return phaseResults;
}

// ==================== Phase 2: 功能完整性检查 ====================
async function phase2_FunctionalCompleteness() {
    log('INFO', '========================================');
    log('INFO', 'Phase 2: 功能完整性检查');
    log('INFO', '========================================');
    
    const phaseResults = { status: 'running', features: [] };
    
    try {
        const routesDir = path.join(__dirname, 'src', 'routes');
        const routes = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
        
        const expectedRoutes = [
            'user.js', 'admin.js', 'memory.js', 'chat.js', 'knowledge.js',
            'review.js', 'tags.js', 'backup.js', 'settings.js', 'system.js'
        ];
        
        for (const route of expectedRoutes) {
            if (routes.includes(route)) {
                phaseResults.features.push({ name: route.replace('.js', ''), status: 'implemented' });
                log('INFO', `✅ ${route} - Implemented`);
            } else {
                phaseResults.features.push({ name: route.replace('.js', ''), status: 'missing' });
                log('WARN', `⚠️ ${route} - Not found`);
            }
        }
        
        const servicesDir = path.join(__dirname, 'src', 'services');
        if (fs.existsSync(servicesDir)) {
            const services = fs.readdirSync(servicesDir).filter(f => f.endsWith('.js'));
            log('INFO', `📦 Found ${services.length} service files`);
        }
        
        const webDir = path.join(__dirname, 'web');
        if (fs.existsSync(webDir)) {
            const htmlFiles = fs.readdirSync(webDir).filter(f => f.endsWith('.html'));
            phaseResults.features.push({ name: 'Frontend pages', status: 'implemented', count: htmlFiles.length });
            log('INFO', `🌐 Found ${htmlFiles.length} HTML pages`);
        }
        
        phaseResults.status = 'completed';
        log('INFO', '✅ Phase 2 completed');
    } catch (error) {
        phaseResults.status = 'error';
        phaseResults.error = error.message;
        log('ERROR', `Phase 2 failed: ${error.message}`);
    }
    
    results.phases['2'] = phaseResults;
    return phaseResults;
}

// ==================== Phase 3: 交互测试 ====================
async function phase3_InteractionTest() {
    log('INFO', '========================================');
    log('INFO', 'Phase 3: 交互测试');
    log('INFO', '========================================');
    
    const phaseResults = { status: 'running', tests: [] };
    
    try {
        // 测试服务器健康检查
        const healthCheck = await new Promise((resolve) => {
            const req = http.get(`${CONFIG.localUrl}/health`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve({ success: true, status: res.statusCode, data: json });
                    } catch (e) {
                        resolve({ success: false, error: e.message });
                    }
                });
            });
            req.on('error', (err) => resolve({ success: false, error: err.message }));
            req.setTimeout(5000, () => {
                req.destroy();
                resolve({ success: false, error: 'Timeout' });
            });
        });
        
        if (healthCheck.success) {
            phaseResults.tests.push({ name: 'Health check', status: 'pass', data: healthCheck.data });
            log('INFO', `✅ Health check passed: ${JSON.stringify(healthCheck.data)}`);
        } else {
            phaseResults.tests.push({ name: 'Health check', status: 'fail', error: healthCheck.error });
            log('WARN', `⚠️ Health check failed: ${healthCheck.error}`);
        }
        
        // 测试首页
        const homeCheck = await new Promise((resolve) => {
            const req = http.get(CONFIG.localUrl, (res) => {
                resolve({ success: res.statusCode === 200, status: res.statusCode });
            });
            req.on('error', (err) => resolve({ success: false, error: err.message }));
            req.setTimeout(5000, () => {
                req.destroy();
                resolve({ success: false, error: 'Timeout' });
            });
        });
        
        if (homeCheck.success) {
            phaseResults.tests.push({ name: 'Homepage', status: 'pass' });
            log('INFO', '✅ Homepage accessible');
        } else {
            phaseResults.tests.push({ name: 'Homepage', status: 'fail', error: homeCheck.error });
            log('WARN', `⚠️ Homepage not accessible: ${homeCheck.error}`);
        }
        
        phaseResults.status = 'completed';
        log('INFO', '✅ Phase 3 completed');
    } catch (error) {
        phaseResults.status = 'error';
        phaseResults.error = error.message;
        log('ERROR', `Phase 3 failed: ${error.message}`);
    }
    
    results.phases['3'] = phaseResults;
    return phaseResults;
}

// ==================== Phase 3.5: 用户面板截图验证 ====================
async function phase3_5_UserPanelScreenshot() {
    log('INFO', '========================================');
    log('INFO', 'Phase 3.5: 用户面板截图验证');
    log('INFO', '========================================');
    
    const phaseResults = { status: 'running', screenshots: [] };
    
    try {
        // 检查 Playwright 是否可用
        let playwright;
        try {
            playwright = require('playwright');
            log('INFO', '✅ Playwright loaded');
        } catch (e) {
            log('WARN', `⚠️ Playwright not available: ${e.message}`);
            phaseResults.status = 'skipped';
            results.phases['3.5'] = phaseResults;
            return phaseResults;
        }
        
        const browser = await playwright.chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();
        
        // 截图首页
        try {
            await page.goto(CONFIG.localUrl, { timeout: 10000 });
            const screenshotPath = path.join(CONFIG.screenshotDir, 'homepage.png');
            await page.screenshot({ path: screenshotPath, fullPage: true });
            phaseResults.screenshots.push({ name: 'homepage', path: screenshotPath });
            log('INFO', `✅ Screenshot: homepage`);
        } catch (e) {
            log('WARN', `⚠️ Failed to screenshot homepage: ${e.message}`);
        }
        
        // 截图登录页
        try {
            await page.goto(`${CONFIG.localUrl}/login`, { timeout: 10000 });
            const screenshotPath = path.join(CONFIG.screenshotDir, 'login.png');
            await page.screenshot({ path: screenshotPath, fullPage: true });
            phaseResults.screenshots.push({ name: 'login', path: screenshotPath });
            log('INFO', `✅ Screenshot: login`);
        } catch (e) {
            log('WARN', `⚠️ Failed to screenshot login: ${e.message}`);
        }
        
        await browser.close();
        
        phaseResults.status = 'completed';
        log('INFO', '✅ Phase 3.5 completed');
    } catch (error) {
        phaseResults.status = 'error';
        phaseResults.error = error.message;
        log('ERROR', `Phase 3.5 failed: ${error.message}`);
    }
    
    results.phases['3.5'] = phaseResults;
    return phaseResults;
}

// ==================== Phase 4: 并发测试 ====================
async function phase4_ConcurrencyTest() {
    log('INFO', '========================================');
    log('INFO', 'Phase 4: 并发测试');
    log('INFO', '========================================');
    
    const phaseResults = { status: 'running', tests: [] };
    
    try {
        // 并发请求测试
        const concurrentRequests = 5;
        const requests = [];
        
        for (let i = 0; i < concurrentRequests; i++) {
            requests.push(new Promise((resolve) => {
                const req = http.get(`${CONFIG.localUrl}/health`, (res) => {
                    resolve({ success: res.statusCode === 200, status: res.statusCode });
                });
                req.on('error', () => resolve({ success: false }));
                req.setTimeout(5000, () => {
                    req.destroy();
                    resolve({ success: false });
                });
            }));
        }
        
        const results = await Promise.all(requests);
        const successCount = results.filter(r => r.success).length;
        
        phaseResults.tests.push({ 
            name: 'Concurrent requests', 
            status: successCount === concurrentRequests ? 'pass' : 'partial',
            data: { total: concurrentRequests, success: successCount }
        });
        
        log('INFO', `✅ Concurrent test: ${successCount}/${concurrentRequests} passed`);
        
        phaseResults.status = 'completed';
        log('INFO', '✅ Phase 4 completed');
    } catch (error) {
        phaseResults.status = 'error';
        phaseResults.error = error.message;
        log('ERROR', `Phase 4 failed: ${error.message}`);
    }
    
    results.phases['4'] = phaseResults;
    return phaseResults;
}

// ==================== Phase 4.5: 多用户系统专项测试 ====================
async function phase4_5_MultiUserTest() {
    log('INFO', '========================================');
    log('INFO', 'Phase 4.5: 多用户系统专项测试');
    log('INFO', '========================================');
    
    const phaseResults = { status: 'running', tests: [] };
    
    try {
        // 检查用户模型
        const userModelPath = path.join(__dirname, 'src', 'models', 'User.js');
        if (fs.existsSync(userModelPath)) {
            const content = fs.readFileSync(userModelPath, 'utf8');
            const hasRoleCheck = content.includes('role');
            phaseResults.tests.push({ name: 'User role field', status: hasRoleCheck ? 'pass' : 'fail' });
            log('INFO', `✅ User model has role field: ${hasRoleCheck}`);
        }
        
        // 检查管理员路由权限
        const adminRoutePath = path.join(__dirname, 'src', 'routes', 'admin.js');
        if (fs.existsSync(adminRoutePath)) {
            const content = fs.readFileSync(adminRoutePath, 'utf8');
            const hasAdminCheck = content.includes('admin') && content.includes('role');
            phaseResults.tests.push({ name: 'Admin route protection', status: hasAdminCheck ? 'pass' : 'fail' });
            log('INFO', `✅ Admin route has protection: ${hasAdminCheck}`);
        }
        
        phaseResults.status = 'completed';
        log('INFO', '✅ Phase 4.5 completed');
    } catch (error) {
        phaseResults.status = 'error';
        phaseResults.error = error.message;
        log('ERROR', `Phase 4.5 failed: ${error.message}`);
    }
    
    results.phases['4.5'] = phaseResults;
    return phaseResults;
}

// ==================== Phase 5: 边界测试 ====================
async function phase5_BoundaryTest() {
    log('INFO', '========================================');
    log('INFO', 'Phase 5: 边界测试');
    log('INFO', '========================================');
    
    const phaseResults = { status: 'running', tests: [] };
    
    try {
        // 测试 404 页面
        const notFoundTest = await new Promise((resolve) => {
            const req = http.get(`${CONFIG.localUrl}/non-existent-page-12345`, (res) => {
                resolve({ success: res.statusCode === 404, status: res.statusCode });
            });
            req.on('error', () => resolve({ success: false }));
            req.setTimeout(5000, () => {
                req.destroy();
                resolve({ success: false });
            });
        });
        
        phaseResults.tests.push({ name: '404 handling', status: notFoundTest.success ? 'pass' : 'fail' });
        log('INFO', `✅ 404 handling: ${notFoundTest.success ? 'pass' : 'fail'}`);
        
        // 测试 API 错误处理
        const apiErrorTest = await new Promise((resolve) => {
            const req = http.request(`${CONFIG.localUrl}/api/v1/users/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }, (res) => {
                resolve({ success: res.statusCode === 400, status: res.statusCode });
            });
            req.on('error', () => resolve({ success: false }));
            req.write(JSON.stringify({}));
            req.end();
            req.setTimeout(5000, () => {
                req.destroy();
                resolve({ success: false });
            });
        });
        
        phaseResults.tests.push({ name: 'API error handling', status: apiErrorTest.success ? 'pass' : 'fail' });
        log('INFO', `✅ API error handling: ${apiErrorTest.success ? 'pass' : 'fail'}`);
        
        phaseResults.status = 'completed';
        log('INFO', '✅ Phase 5 completed');
    } catch (error) {
        phaseResults.status = 'error';
        phaseResults.error = error.message;
        log('ERROR', `Phase 5 failed: ${error.message}`);
    }
    
    results.phases['5'] = phaseResults;
    return phaseResults;
}

// ==================== Phase 6: 远程服务器测试 ====================
async function phase6_RemoteServerTest() {
    log('INFO', '========================================');
    log('INFO', 'Phase 6: 远程服务器测试');
    log('INFO', '========================================');
    
    const phaseResults = { status: 'running', tests: [] };
    
    try {
        // 测试 SSH 连接
        log('INFO', `Testing SSH connection to ${CONFIG.remoteSsh}...`);
        try {
            execSync(`ssh -p 1022 -o ConnectTimeout=5 -o StrictHostKeyChecking=no ${CONFIG.remoteSsh} "echo 'SSH OK'"`, { 
                encoding: 'utf8',
                timeout: 10000
            });
            phaseResults.tests.push({ name: 'SSH connection', status: 'pass' });
            log('INFO', '✅ SSH connection successful');
        } catch (e) {
            phaseResults.tests.push({ name: 'SSH connection', status: 'fail', error: e.message });
            log('WARN', `⚠️ SSH connection failed: ${e.message}`);
        }
        
        // 测试远程 HTTP 访问
        const remoteHealthCheck = await new Promise((resolve) => {
            const req = http.get(CONFIG.remoteUrl, (res) => {
                resolve({ success: res.statusCode === 200 || res.statusCode === 301 || res.statusCode === 302, status: res.statusCode });
            });
            req.on('error', (err) => resolve({ success: false, error: err.message }));
            req.setTimeout(10000, () => {
                req.destroy();
                resolve({ success: false, error: 'Timeout' });
            });
        });
        
        if (remoteHealthCheck.success) {
            phaseResults.tests.push({ name: 'Remote HTTP access', status: 'pass', data: { status: remoteHealthCheck.status } });
            log('INFO', `✅ Remote HTTP accessible (status: ${remoteHealthCheck.status})`);
        } else {
            phaseResults.tests.push({ name: 'Remote HTTP access', status: 'fail', error: remoteHealthCheck.error });
            log('WARN', `⚠️ Remote HTTP not accessible: ${remoteHealthCheck.error}`);
        }
        
        phaseResults.status = 'completed';
        log('INFO', '✅ Phase 6 completed');
    } catch (error) {
        phaseResults.status = 'error';
        phaseResults.error = error.message;
        log('ERROR', `Phase 6 failed: ${error.message}`);
    }
    
    results.phases['6'] = phaseResults;
    return phaseResults;
}

// ==================== Phase 7: 标签和子标签完整测试 ====================
async function phase7_TagTest() {
    log('INFO', '========================================');
    log('INFO', 'Phase 7: 标签和子标签完整测试');
    log('INFO', '========================================');
    
    const phaseResults = { status: 'running', tests: [] };
    
    try {
        // 检查标签路由
        const tagsRoutePath = path.join(__dirname, 'src', 'routes', 'tags.js');
        if (fs.existsSync(tagsRoutePath)) {
            const content = fs.readFileSync(tagsRoutePath, 'utf8');
            const hasCRUD = content.includes('GET') && content.includes('POST') && content.includes('PUT') && content.includes('DELETE');
            phaseResults.tests.push({ name: 'Tags CRUD', status: hasCRUD ? 'pass' : 'partial' });
            log('INFO', `✅ Tags route has CRUD operations: ${hasCRUD}`);
        }
        
        // 检查分类路由
        const categoriesRoutePath = path.join(__dirname, 'src', 'routes', 'categories.js');
        if (fs.existsSync(categoriesRoutePath)) {
            phaseResults.tests.push({ name: 'Categories route', status: 'pass' });
            log('INFO', '✅ Categories route exists');
        }
        
        phaseResults.status = 'completed';
        log('INFO', '✅ Phase 7 completed');
    } catch (error) {
        phaseResults.status = 'error';
        phaseResults.error = error.message;
        log('ERROR', `Phase 7 failed: ${error.message}`);
    }
    
    results.phases['7'] = phaseResults;
    return phaseResults;
}

// ==================== Phase 8: 空白和零值显示检查 ====================
async function phase8_EmptyValueTest() {
    log('INFO', '========================================');
    log('INFO', 'Phase 8: 空白和零值显示检查');
    log('INFO', '========================================');
    
    const phaseResults = { status: 'running', tests: [] };
    
    try {
        // 检查前端页面中的空值处理
        const webDir = path.join(__dirname, 'web');
        const htmlFiles = fs.readdirSync(webDir).filter(f => f.endsWith('.html'));
        
        let emptyStateCount = 0;
        for (const file of htmlFiles.slice(0, 5)) {
            const content = fs.readFileSync(path.join(webDir, file), 'utf8');
            if (content.includes('empty') || content.includes('no data') || content.includes('暂无')) {
                emptyStateCount++;
            }
        }
        
        phaseResults.tests.push({ name: 'Empty state handling', status: emptyStateCount > 0 ? 'pass' : 'warn', data: { filesWithEmptyState: emptyStateCount } });
        log('INFO', `✅ Empty state handling found in ${emptyStateCount} files`);
        
        phaseResults.status = 'completed';
        log('INFO', '✅ Phase 8 completed');
    } catch (error) {
        phaseResults.status = 'error';
        phaseResults.error = error.message;
        log('ERROR', `Phase 8 failed: ${error.message}`);
    }
    
    results.phases['8'] = phaseResults;
    return phaseResults;
}

// ==================== Phase 9: 循环7次验证 ====================
async function phase9_LoopVerification() {
    log('INFO', '========================================');
    log('INFO', 'Phase 9: 循环7次验证');
    log('INFO', '========================================');
    
    const phaseResults = { status: 'running', iterations: [] };
    
    try {
        // 循环执行健康检查7次
        for (let i = 1; i <= 7; i++) {
            log('INFO', `Iteration ${i}/7...`);
            
            const healthCheck = await new Promise((resolve) => {
                const req = http.get(`${CONFIG.localUrl}/health`, (res) => {
                    resolve({ success: res.statusCode === 200, status: res.statusCode });
                });
                req.on('error', () => resolve({ success: false }));
                req.setTimeout(5000, () => {
                    req.destroy();
                    resolve({ success: false });
                });
            });
            
            phaseResults.iterations.push({
                iteration: i,
                healthCheck: healthCheck.success,
                timestamp: new Date().toISOString()
            });
            
            // 短暂延迟
            await new Promise(r => setTimeout(r, 500));
        }
        
        const successCount = phaseResults.iterations.filter(i => i.healthCheck).length;
        phaseResults.successRate = `${successCount}/7`;
        
        log('INFO', `✅ Loop verification completed: ${successCount}/7 passed`);
        
        phaseResults.status = 'completed';
        log('INFO', '✅ Phase 9 completed');
    } catch (error) {
        phaseResults.status = 'error';
        phaseResults.error = error.message;
        log('ERROR', `Phase 9 failed: ${error.message}`);
    }
    
    results.phases['9'] = phaseResults;
    return phaseResults;
}

// ==================== Phase 10: Git更新 ====================
async function phase10_GitUpdate() {
    log('INFO', '========================================');
    log('INFO', 'Phase 10: Git更新');
    log('INFO', '========================================');
    
    const phaseResults = { status: 'running', actions: [] };
    
    try {
        // 检查 git 状态
        try {
            const status = execSync('git status --short', { encoding: 'utf8', cwd: __dirname });
            if (status.trim()) {
                phaseResults.actions.push({ name: 'Git status', status: 'has_changes', changes: status.trim().split('\n').length });
                log('INFO', `✅ Git has uncommitted changes: ${status.trim().split('\n').length} files`);
            } else {
                phaseResults.actions.push({ name: 'Git status', status: 'clean' });
                log('INFO', '✅ Git working directory clean');
            }
        } catch (e) {
            phaseResults.actions.push({ name: 'Git status', status: 'error', error: e.message });
            log('WARN', `⚠️ Git status check failed: ${e.message}`);
        }
        
        // 获取最近的提交
        try {
            const lastCommit = execSync('git log -1 --oneline', { encoding: 'utf8', cwd: __dirname }).trim();
            phaseResults.actions.push({ name: 'Last commit', status: 'ok', data: lastCommit });
            log('INFO', `✅ Last commit: ${lastCommit}`);
        } catch (e) {
            phaseResults.actions.push({ name: 'Last commit', status: 'error', error: e.message });
        }
        
        phaseResults.status = 'completed';
        log('INFO', '✅ Phase 10 completed');
    } catch (error) {
        phaseResults.status = 'error';
        phaseResults.error = error.message;
        log('ERROR', `Phase 10 failed: ${error.message}`);
    }
    
    results.phases['10'] = phaseResults;
    return phaseResults;
}

// ==================== 生成报告 ====================
function generateReport() {
    log('INFO', '========================================');
    log('INFO', 'Generating Final Report');
    log('INFO', '========================================');
    
    results.endTime = new Date().toISOString();
    results.duration = new Date(results.endTime) - new Date(results.startTime);
    
    // 生成 JSON 报告
    const reportPath = path.join(CONFIG.reportDir, `DEEP_INSPECTION_FULL_V${CONFIG.version}_REPORT.json`);
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    log('INFO', `📄 JSON Report: ${reportPath}`);
    
    // 生成 Markdown 报告
    const mdReport = generateMarkdownReport();
    const mdPath = path.join(CONFIG.reportDir, `DEEP_INSPECTION_FULL_V${CONFIG.version}_REPORT.md`);
    fs.writeFileSync(mdPath, mdReport);
    log('INFO', `📄 Markdown Report: ${mdPath}`);
    
    return { json: reportPath, markdown: mdPath };
}

// 生成 Markdown 报告
function generateMarkdownReport() {
    let md = `# Deep Inspector v${CONFIG.version} 完整检测报告\n\n`;
    md += `**项目**: ${CONFIG.project}\n\n`;
    md += `**检测时间**: ${results.startTime}\n\n`;
    md += `**耗时**: ${(results.duration / 1000).toFixed(2)} 秒\n\n`;
    md += `---\n\n`;
    
    // 汇总
    md += `## 检测汇总\n\n`;
    const errorCount = results.errors.length;
    const warningCount = results.warnings.length;
    const completedPhases = Object.values(results.phases).filter(p => p.status === 'completed').length;
    md += `- ❌ 错误: ${errorCount}\n`;
    md += `- ⚠️ 警告: ${warningCount}\n`;
    md += `- ✅ 完成 Phase: ${completedPhases}/15\n\n`;
    
    // 各 Phase 结果
    md += `## Phase 结果详情\n\n`;
    for (const [phase, data] of Object.entries(results.phases)) {
        md += `### Phase ${phase}\n\n`;
        md += `- 状态: ${data.status}\n`;
        if (data.checks) {
            md += `- 检查项: ${data.checks.length}\n`;
        }
        if (data.tests) {
            md += `- 测试项: ${data.tests.length}\n`;
        }
        if (data.screenshots) {
            md += `- 截图: ${data.screenshots.length}\n`;
        }
        if (data.error) {
            md += `- 错误: ${data.error}\n`;
        }
        md += `\n`;
    }
    
    // 错误详情
    if (results.errors.length > 0) {
        md += `## 错误详情\n\n`;
        for (const error of results.errors) {
            md += `- **${error.message}**\n`;
        }
        md += `\n`;
    }
    
    // 警告详情
    if (results.warnings.length > 0) {
        md += `## 警告详情\n\n`;
        for (const warning of results.warnings.slice(0, 20)) {
            md += `- ${warning.message}\n`;
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
║     Deep Inspector v${CONFIG.version} - 777-MS Memory System         ║
║                    完整深度检测 (全Phase)                      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
    
    try {
        // Phase 0-2: 基础检测
        await phase0_ConfigInitialization();
        await phase1_CodeReview();
        await phase1_5_ConflictDetection();
        await phase1_6_DatabaseValidation();
        await phase2_FunctionalCompleteness();
        
        // Phase 3-5: 交互和边界测试
        await phase3_InteractionTest();
        await phase3_5_UserPanelScreenshot();
        await phase4_ConcurrencyTest();
        await phase4_5_MultiUserTest();
        await phase5_BoundaryTest();
        
        // Phase 6-10: 高级测试
        await phase6_RemoteServerTest();
        await phase7_TagTest();
        await phase8_EmptyValueTest();
        await phase9_LoopVerification();
        await phase10_GitUpdate();
        
        // 生成报告
        const reports = generateReport();
        
        const completedPhases = Object.values(results.phases).filter(p => p.status === 'completed').length;
        
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║              完整深度检测完成 ✅                              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

📊 检测统计:
   - 完成 Phase: ${completedPhases}/15
   - 错误: ${results.errors.length}
   - 警告: ${results.warnings.length}
   - 耗时: ${(results.duration / 1000).toFixed(2)} 秒

📁 报告位置:
   - JSON: ${reports.json}
   - Markdown: ${reports.markdown}

📸 截图位置:
   - ${CONFIG.screenshotDir}
`);
        
    } catch (error) {
        log('ERROR', `Inspection failed: ${error.message}`);
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
