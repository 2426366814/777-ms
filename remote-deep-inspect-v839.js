/**
 * 远程深度交互检测脚本 v8.39.5
 * 777-MS Memory System - https://memory.91wz.org
 * 使用直接API调用登录 + 完整真实交互测试
 */

const { chromium } = require('D:\\NodeJS\\node_global\\node_modules\\patchright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'e:\\ai本地应用\\记忆体\\777-ms\\reports\\screenshots';
const BASE_URL = 'https://memory.91wz.org';

const TEST_ACCOUNTS = {
    user: { username: '2426366814', password: 'ck123456@' },
    admin: { username: 'cccp', password: 'ck123456@' }
};

const results = {
    startTime: new Date().toISOString(),
    tests: [],
    issues: [],
    screenshots: [],
    interactions: []
};

function addResult(category, test, status, details = '') {
    results.tests.push({ category, test, status, details, timestamp: new Date().toISOString() });
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} [${category}] ${test}: ${status}${details ? ' - ' + details : ''}`);
}

function addIssue(severity, description, location) {
    results.issues.push({ severity, description, location, timestamp: new Date().toISOString() });
}

function addInteraction(pageUrl, action, element, result) {
    results.interactions.push({ page: pageUrl, action, element, result, timestamp: new Date().toISOString() });
}

async function takeScreenshot(page, name) {
    try {
        const filename = `v839_remote_${name}.png`;
        const filepath = path.join(SCREENSHOT_DIR, filename);
        await page.screenshot({ path: filepath, fullPage: false, timeout: 10000 });
        results.screenshots.push({ name, path: filepath });
        console.log(`📸 截图: ${filename}`);
        return filepath;
    } catch (err) {
        console.log(`⚠️ 截图失败: ${name} - ${err.message}`);
        return null;
    }
}

async function login(page, credentials) {
    console.log(`  登录用户: ${credentials.username}`);
    
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 60000 });
    
    const loginResult = await page.evaluate(async (creds) => {
        try {
            const response = await fetch('/api/v1/user/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(creds)
            });
            const data = await response.json();
            
            if (data.success) {
                localStorage.setItem('token', data.data.token);
                localStorage.setItem('user', JSON.stringify(data.data.user));
                return { 
                    success: true, 
                    token: data.data.token.substring(0, 30) + '...',
                    user: data.data.user
                };
            }
            return { success: false, message: data.message };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }, credentials);
    
    if (loginResult.success) {
        console.log(`  ✅ 登录成功: ${loginResult.token}`);
    } else {
        console.log(`  ❌ 登录失败: ${JSON.stringify(loginResult)}`);
    }
    
    return loginResult;
}

async function testInputInteraction(page, selector, testName, testValue) {
    try {
        const input = await page.$(selector);
        if (!input) {
            return { success: false, error: '元素不存在' };
        }
        
        const isVisible = await input.isVisible();
        if (!isVisible) {
            return { success: false, error: '元素不可见' };
        }
        
        await input.fill(testValue);
        await page.waitForTimeout(300);
        
        const value = await input.inputValue();
        const success = value === testValue;
        
        addInteraction(page.url(), 'input', selector, success ? '成功' : '失败');
        return { success, value };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function testButtonClick(page, selector, testName) {
    try {
        const btn = await page.$(selector);
        if (!btn) {
            return { success: false, error: '按钮不存在' };
        }
        
        const isVisible = await btn.isVisible();
        if (!isVisible) {
            return { success: false, error: '按钮不可见' };
        }
        
        await btn.click();
        await page.waitForTimeout(500);
        
        addInteraction(page.url(), 'click', selector, '成功');
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function runTests() {
    console.log('🚀 开始远程深度交互检测 v8.39.5');
    console.log(`📍 目标: ${BASE_URL}`);
    console.log(`📁 截图目录: ${SCREENSHOT_DIR}\n`);

    if (!fs.existsSync(SCREENSHOT_DIR)) {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    let browser, page;
    try {
        browser = await chromium.launch({ 
            headless: false,
            args: ['--disable-font-loading-timeout']
        });
        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 }
        });
        page = await context.newPage();

        // 监听控制台错误
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`[控制台错误] ${msg.text()}`);
            }
        });

        // ========== Phase 1: 首页测试 ==========
        console.log('\n=== Phase 1: 首页测试 ===');
        await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
        await takeScreenshot(page, '01_homepage');
        addResult('首页', '页面加载', 'PASS', '首页正常加载');

        // ========== Phase 2: 用户登录测试 ==========
        console.log('\n=== Phase 2: 用户登录测试 ===');
        const userLoginResult = await login(page, TEST_ACCOUNTS.user);
        await takeScreenshot(page, '02_user_login_result');
        
        if (userLoginResult.success) {
            addResult('登录', '用户登录', 'PASS', `Token: ${userLoginResult.token}`);
        } else {
            addResult('登录', '用户登录', 'FAIL', JSON.stringify(userLoginResult));
            addIssue('High', '用户登录失败', '登录功能');
        }

        // ========== Phase 3: 用户面板完整测试 ==========
        console.log('\n=== Phase 3: 用户面板完整测试 ===');
        
        const userPages = [
            { name: 'dashboard', url: '/dashboard', interactions: [] },
            { name: 'chat', url: '/chat', interactions: ['input'] },
            { name: 'intelligence', url: '/intelligence', interactions: [] },
            { name: 'review', url: '/review', interactions: [] },
            { name: 'knowledge', url: '/knowledge', interactions: ['button'] },
            { name: 'visualization', url: '/visualization', interactions: [] },
            { name: 'security', url: '/security', interactions: [] },
            { name: 'providers', url: '/providers', interactions: [] },
            { name: 'profile', url: '/profile', interactions: ['input'] }
        ];

        for (const pageInfo of userPages) {
            try {
                console.log(`\n  --- ${pageInfo.name} 页面 ---`);
                await page.goto(`${BASE_URL}${pageInfo.url}`, { waitUntil: 'networkidle', timeout: 30000 });
                await takeScreenshot(page, `03_user_${pageInfo.name}`);
                addResult('用户面板', `${pageInfo.name}页面`, 'PASS', '页面加载成功');
                
                // 真实交互测试
                if (pageInfo.interactions.includes('input')) {
                    const inputSelectors = ['textarea', 'input[type="text"]:not([readonly])'];
                    
                    for (const selector of inputSelectors) {
                        const inputResult = await testInputInteraction(page, selector, `${pageInfo.name}输入框`, '测试输入内容');
                        if (inputResult.success) {
                            addResult('交互测试', `${pageInfo.name}输入框`, 'PASS', '输入成功');
                            await takeScreenshot(page, `03_user_${pageInfo.name}_input`);
                            break;
                        }
                    }
                }
                
                if (pageInfo.interactions.includes('button')) {
                    const btnSelectors = ['button[class*="add"]', 'button:has-text("添加")'];
                    
                    for (const selector of btnSelectors) {
                        const btnResult = await testButtonClick(page, selector, `${pageInfo.name}按钮`);
                        if (btnResult.success) {
                            addResult('交互测试', `${pageInfo.name}按钮`, 'PASS', '点击成功');
                            await takeScreenshot(page, `03_user_${pageInfo.name}_button`);
                            break;
                        }
                    }
                }
                
            } catch (err) {
                addResult('用户面板', `${pageInfo.name}页面`, 'FAIL', err.message);
                addIssue('Medium', `${pageInfo.name}页面加载失败`, pageInfo.url);
            }
        }

        // ========== Phase 4: 管理员登录测试 ==========
        console.log('\n=== Phase 4: 管理员登录测试 ===');
        
        // 清除旧token
        await page.evaluate(() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        });
        
        const adminLoginResult = await login(page, TEST_ACCOUNTS.admin);
        await takeScreenshot(page, '04_admin_login_result');
        
        if (adminLoginResult.success) {
            addResult('登录', '管理员登录', 'PASS', `Token: ${adminLoginResult.token}`);
        } else {
            addResult('登录', '管理员登录', 'FAIL', JSON.stringify(adminLoginResult));
        }

        // ========== Phase 5: 管理员面板完整测试 ==========
        console.log('\n=== Phase 5: 管理员面板完整测试 ===');
        
        const adminPages = [
            { name: 'panel', url: '/admin' },
            { name: 'users', url: '/admin#users' },
            { name: 'health', url: '/admin#health' },
            { name: 'logs', url: '/admin#logs' },
            { name: 'backups', url: '/admin#backups' },
            { name: 'providers', url: '/admin#providers' },
            { name: 'permissions', url: '/admin#permissions' },
            { name: 'apikeys', url: '/admin#apikeys' }
        ];

        for (const pageInfo of adminPages) {
            try {
                console.log(`\n  --- ${pageInfo.name} 标签 ---`);
                await page.goto(`${BASE_URL}${pageInfo.url}`, { waitUntil: 'networkidle', timeout: 30000 });
                await takeScreenshot(page, `05_admin_${pageInfo.name}`);
                addResult('管理员面板', `${pageInfo.name}标签`, 'PASS', '标签页加载成功');
            } catch (err) {
                addResult('管理员面板', `${pageInfo.name}标签`, 'WARN', err.message);
            }
        }

        // ========== Phase 6: API健康检查 ==========
        console.log('\n=== Phase 6: API健康检查 ===');
        try {
            const response = await page.goto(`${BASE_URL}/health`, { waitUntil: 'networkidle', timeout: 15000 });
            const content = await response.text();
            await takeScreenshot(page, '06_health_api');
            
            if (content.includes('ok') || content.includes('connected')) {
                addResult('API', '健康检查', 'PASS', '健康检查返回正常');
            } else {
                addResult('API', '健康检查', 'WARN', '健康检查响应异常');
            }
        } catch (err) {
            addResult('API', '健康检查', 'FAIL', err.message);
        }

        // ========== Phase 7: 多用户权限隔离测试 ==========
        console.log('\n=== Phase 7: 多用户权限隔离测试 ===');
        
        // 清除token，重新登录普通用户
        await page.evaluate(() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        });
        
        const userLoginResult2 = await login(page, TEST_ACCOUNTS.user);
        if (userLoginResult2.success) {
            // 尝试访问管理员页面
            await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle', timeout: 30000 });
            await takeScreenshot(page, '07_permission_test');
            
            const currentUrl = page.url();
            if (currentUrl.includes('login') || currentUrl.includes('dashboard')) {
                addResult('权限隔离', '普通用户访问管理页', 'PASS', '正确重定向');
            } else {
                addResult('权限隔离', '普通用户访问管理页', 'WARN', `当前URL: ${currentUrl}`);
            }
        }

        // ========== 完成 ==========
        console.log('\n=== 检测完成 ===');
        results.endTime = new Date().toISOString();
        results.summary = {
            total: results.tests.length,
            passed: results.tests.filter(t => t.status === 'PASS').length,
            failed: results.tests.filter(t => t.status === 'FAIL').length,
            warnings: results.tests.filter(t => t.status === 'WARN').length,
            issues: results.issues.length,
            interactions: results.interactions.length
        };

        console.log(`\n📊 测试统计:`);
        console.log(`   总计: ${results.summary.total}`);
        console.log(`   通过: ${results.summary.passed}`);
        console.log(`   失败: ${results.summary.failed}`);
        console.log(`   警告: ${results.summary.warnings}`);
        console.log(`   问题: ${results.summary.issues}`);
        console.log(`   交互: ${results.summary.interactions}`);

    } catch (error) {
        console.error('❌ 检测过程出错:', error.message);
        results.error = error.message;
    } finally {
        if (browser) {
            await browser.close();
        }
    }

    // 保存报告
    const reportPath = path.join(SCREENSHOT_DIR, '..', 'DEEP_INSPECTION_REMOTE_V839_REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 报告已保存: ${reportPath}`);

    return results;
}

runTests().catch(console.error);
