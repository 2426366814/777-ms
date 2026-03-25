/**
 * 777-MS 远程深度检测脚本 v8.40
 * 使用 Playwright + MCP 进行完整交互测试
 */

const { chromium } = require('D:\\playwright-data\\lib\\node_modules\\playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://memory.91wz.org';
const SCREENSHOT_DIR = 'e:\\ai本地应用\\记忆体\\777-ms\\reports\\screenshots\\deep_v851';

const TEST_ACCOUNTS = {
    admin: { username: '2426366814', password: 'ck123456@' },
    test: { username: 'test', password: 'test123456' }
};

const PAGES = [
    { path: '/', name: '首页' },
    { path: '/login', name: '登录页' },
    { path: '/dashboard', name: '仪表盘' },
    { path: '/chat', name: 'AI对话' },
    { path: '/intelligence', name: '智能功能' },
    { path: '/review', name: '记忆复习' },
    { path: '/knowledge', name: '知识库' },
    { path: '/visualization', name: '数据可视化' },
    { path: '/security', name: '安全设置' },
    { path: '/providers', name: '提供商管理' },
    { path: '/profile', name: '用户资料' },
    { path: '/admin', name: '管理后台' }
];

const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    errors: [],
    screenshots: []
};

function log(message, type = 'info') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const colors = {
        info: '\x1b[36m',
        success: '\x1b[32m',
        error: '\x1b[31m',
        warn: '\x1b[33m'
    };
    console.log(`${colors[type]}[${timestamp}] ${message}\x1b[0m`);
}

async function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

async function takeScreenshot(page, name) {
    const filename = `${name}.png`;
    const filepath = path.join(SCREENSHOT_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    results.screenshots.push({ name, path: filepath });
    log(`截图保存: ${filename}`, 'info');
    return filepath;
}

async function testHealthCheck(page) {
    log('测试: API Health Check...', 'info');
    try {
        const response = await page.goto(`${BASE_URL}/health`, { waitUntil: 'networkidle' });
        const data = await response.json();
        
        if (data.status === 'ok' && data.database === 'connected') {
            log('✅ Health Check 通过', 'success');
            results.passed++;
            return true;
        } else {
            log(`❌ Health Check 失败: ${JSON.stringify(data)}`, 'error');
            results.failed++;
            results.errors.push({ test: 'Health Check', error: JSON.stringify(data) });
            return false;
        }
    } catch (error) {
        log(`❌ Health Check 异常: ${error.message}`, 'error');
        results.failed++;
        results.errors.push({ test: 'Health Check', error: error.message });
        return false;
    }
}

async function testLoginPage(page) {
    log('测试: 登录页面...', 'info');
    try {
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
        await takeScreenshot(page, '01_login_page');
        
        const usernameInput = await page.$('#username') || await page.$('input[name="username"]') || await page.$('input[type="text"]');
        const passwordInput = await page.$('#password') || await page.$('input[name="password"]') || await page.$('input[type="password"]');
        
        if (!usernameInput || !passwordInput) {
            log('❌ 找不到登录表单', 'error');
            results.failed++;
            return false;
        }
        
        await usernameInput.fill(TEST_ACCOUNTS.admin.username);
        await passwordInput.fill(TEST_ACCOUNTS.admin.password);
        await takeScreenshot(page, '02_login_filled');
        
        const submitBtn = await page.$('#loginBtn') || await page.$('button[type="submit"]');
        if (submitBtn) {
            await submitBtn.click();
            await page.waitForTimeout(5000);
        }
        
        const currentUrl = page.url();
        if (!currentUrl.includes('login')) {
            log('✅ 登录成功', 'success');
            results.passed++;
            await takeScreenshot(page, '03_after_login');
            return true;
        } else {
            log('❌ 登录失败 - 仍在登录页', 'error');
            results.failed++;
            await takeScreenshot(page, '03_login_failed');
            return false;
        }
    } catch (error) {
        log(`❌ 登录测试异常: ${error.message}`, 'error');
        results.failed++;
        results.errors.push({ test: 'Login', error: error.message });
        return false;
    }
}

async function testUserPages(page) {
    log('测试: 用户页面...', 'info');
    
    for (const pageInfo of PAGES) {
        if (pageInfo.path === '/' || pageInfo.path === '/login') continue;
        
        try {
            log(`  测试页面: ${pageInfo.name} (${pageInfo.path})`, 'info');
            await page.goto(`${BASE_URL}${pageInfo.path}`, { waitUntil: 'networkidle', timeout: 15000 });
            await page.waitForTimeout(1000);
            
            const screenshotName = `user_${pageInfo.name.replace(/\s+/g, '_')}`;
            await takeScreenshot(page, screenshotName);
            
            const bodyText = await page.textContent('body');
            if (bodyText.includes('错误') || bodyText.includes('Error') || bodyText.includes('404')) {
                log(`  ⚠️ ${pageInfo.name} 页面可能有错误`, 'warn');
                results.warnings++;
            } else {
                log(`  ✅ ${pageInfo.name} 页面正常`, 'success');
                results.passed++;
            }
        } catch (error) {
            log(`  ❌ ${pageInfo.name} 页面测试失败: ${error.message}`, 'error');
            results.failed++;
        }
    }
}

async function testAdminPanel(page) {
    log('测试: 管理员面板...', 'info');
    try {
        await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        await takeScreenshot(page, 'admin_01_panel');
        
        const tabs = await page.$$('.tab-item, .nav-item, .sidebar-item, [role="tab"]');
        if (tabs.length > 0) {
            log(`  发现 ${tabs.length} 个标签`, 'info');
            
            for (let i = 0; i < Math.min(tabs.length, 10); i++) {
                try {
                    const tabText = await tabs[i].textContent();
                    await tabs[i].click();
                    await page.waitForTimeout(500);
                    await takeScreenshot(page, `admin_tab_${i + 1}_${tabText?.trim().replace(/\s+/g, '_') || 'unknown'}`);
                    log(`  ✅ 点击标签: ${tabText?.trim()}`, 'success');
                    results.passed++;
                } catch (e) {
                    log(`  ⚠️ 标签点击失败: ${e.message}`, 'warn');
                    results.warnings++;
                }
            }
        }
        
        log('✅ 管理员面板测试完成', 'success');
    } catch (error) {
        log(`❌ 管理员面板测试失败: ${error.message}`, 'error');
        results.failed++;
    }
}

async function testTokenExpiration(page) {
    log('测试: Token 过期处理...', 'info');
    try {
        await page.evaluate(() => {
            localStorage.setItem('token', 'invalid_test_token_12345');
        });
        
        const response = await page.request.get(`${BASE_URL}/api/v1/memories`, {
            headers: { 'Authorization': 'Bearer invalid_test_token_12345' }
        });
        
        if (response.status() === 401) {
            log('✅ Token 过期正确返回 401', 'success');
            results.passed++;
        } else {
            log(`❌ Token 过期处理异常，状态码: ${response.status()}`, 'error');
            results.failed++;
        }
    } catch (error) {
        log(`❌ Token 测试异常: ${error.message}`, 'error');
        results.failed++;
    }
}

async function testRateLimiting(page) {
    log('测试: Rate Limiting...', 'info');
    try {
        const requests = [];
        for (let i = 0; i < 15; i++) {
            requests.push(page.request.get(`${BASE_URL}/api/v1/health`));
        }
        
        const responses = await Promise.all(requests);
        const rateLimited = responses.some(r => r.status() === 429);
        
        if (rateLimited) {
            log('✅ Rate Limiting 正常工作', 'success');
            results.passed++;
        } else {
            log('⚠️ Rate Limiting 未触发 (阈值较高)', 'warn');
            results.warnings++;
        }
    } catch (error) {
        log(`❌ Rate Limiting 测试异常: ${error.message}`, 'error');
        results.failed++;
    }
}

async function testConsoleErrors(page) {
    log('测试: 控制台错误检查...', 'info');
    const errors = [];
    
    page.on('console', msg => {
        if (msg.type() === 'error') {
            errors.push(msg.text());
        }
    });
    
    page.on('pageerror', error => {
        errors.push(error.message);
    });
    
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    if (errors.length === 0) {
        log('✅ 无控制台错误', 'success');
        results.passed++;
    } else {
        log(`⚠️ 发现 ${errors.length} 个控制台错误`, 'warn');
        errors.forEach(err => log(`  - ${err}`, 'warn'));
        results.warnings += errors.length;
    }
}

async function generateReport() {
    log('========================================', 'info');
    log('深度检测报告', 'info');
    log('========================================', 'info');
    log(`✅ 通过: ${results.passed}`, 'success');
    log(`❌ 失败: ${results.failed}`, 'error');
    log(`⚠️ 警告: ${results.warnings}`, 'warn');
    log(`📸 截图: ${results.screenshots.length}`, 'info');
    
    if (results.errors.length > 0) {
        log('错误详情:', 'error');
        results.errors.forEach(err => {
            log(`  - ${err.test}: ${err.error}`, 'error');
        });
    }
    
    const reportPath = path.join(SCREENSHOT_DIR, 'DEEP_INSPECTION_V851_REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    log(`报告已保存: ${reportPath}`, 'info');
    
    return results;
}

async function main() {
    log('========================================', 'info');
    log('777-MS 远程深度检测 v8.51', 'info');
    log(`目标: ${BASE_URL}`, 'info');
    log('========================================', 'info');
    
    await ensureDir(SCREENSHOT_DIR);
    
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    
    const page = await context.newPage();
    
    try {
        await testHealthCheck(page);
        await testLoginPage(page);
        await testUserPages(page);
        await testAdminPanel(page);
        await testTokenExpiration(page);
        await testRateLimiting(page);
        await testConsoleErrors(page);
    } catch (error) {
        log(`测试执行异常: ${error.message}`, 'error');
        results.errors.push({ test: 'Main', error: error.message });
    } finally {
        await browser.close();
    }
    
    await generateReport();
    
    return results.failed === 0;
}

main().then(success => {
    process.exit(success ? 0 : 1);
}).catch(err => {
    console.error('执行失败:', err);
    process.exit(1);
});
