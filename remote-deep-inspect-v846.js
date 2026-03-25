/**
 * 远程深度检测脚本 v8.46
 * 777-MS Memory System - 完整功能测试
 */

const { playwrightGlobal } = require('D:\\playwright-data\\lib\\playwright-global.js');
const fs = require('fs');
const path = require('path');

const CONFIG = {
    baseUrl: 'https://memory.91wz.org',
    screenshotsDir: path.join(__dirname, 'reports', 'screenshots', 'remote_v846'),
    users: {
        admin: { username: 'cccp', password: 'ck123456@' },
        user: { username: '2426366814', password: 'ck123456@' }
    },
    timeout: 30000
};

const results = {
    phase: 'Remote Deep Inspection v8.46',
    timestamp: new Date().toISOString(),
    tests: [],
    issues: [],
    screenshots: []
};

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(page, name) {
    const filepath = path.join(CONFIG.screenshotsDir, `${name}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    results.screenshots.push({ name, path: filepath });
    console.log(`  📸 截图: ${name}.png`);
    return filepath;
}

async function testAPI() {
    console.log('\n=== Phase 2: API 功能测试 ===\n');
    
    const tests = [
        { name: '健康检查', method: 'GET', url: '/health' },
        { name: 'API文档', method: 'GET', url: '/api/v1/docs' },
        { name: '公开状态', method: 'GET', url: '/api/v1/public/status' }
    ];
    
    for (const test of tests) {
        try {
            const fetch = (await import('node-fetch')).default;
            const response = await fetch(`${CONFIG.baseUrl}${test.url}`, {
                method: test.method,
                timeout: 10000
            });
            const status = response.status;
            const passed = status >= 200 && status < 500;
            
            results.tests.push({
                phase: 'API',
                name: test.name,
                url: test.url,
                status,
                passed
            });
            
            console.log(`  ${passed ? '✅' : '❌'} ${test.name}: ${status}`);
        } catch (error) {
            results.tests.push({
                phase: 'API',
                name: test.name,
                url: test.url,
                error: error.message,
                passed: false
            });
            console.log(`  ❌ ${test.name}: ${error.message}`);
        }
    }
}

async function testUserFlow(session) {
    console.log('\n=== Phase 3: 用户流程测试 ===\n');
    const { page } = session;
    
    try {
        console.log('📍 步骤1: 访问登录页面');
        await page.goto(`${CONFIG.baseUrl}/login`, { waitUntil: 'networkidle' });
        await sleep(1000);
        await takeScreenshot(page, 'user_01_login_page');
        
        console.log('📍 步骤2: 填写用户登录表单');
        const usernameInput = await page.$('input[name="username"], input[type="text"], #username');
        const passwordInput = await page.$('input[name="password"], input[type="password"], #password');
        const loginBtn = await page.$('button[type="submit"], .login-btn, #loginBtn');
        
        if (usernameInput && passwordInput) {
            await usernameInput.fill(CONFIG.users.user.username);
            await passwordInput.fill(CONFIG.users.user.password);
            await takeScreenshot(page, 'user_02_login_filled');
            
            if (loginBtn) {
                console.log('📍 步骤3: 点击登录按钮');
                await loginBtn.click();
                await sleep(3000);
                await takeScreenshot(page, 'user_03_after_login');
                
                const currentUrl = page.url();
                const loginSuccess = !currentUrl.includes('/login');
                results.tests.push({
                    phase: 'User Flow',
                    name: '用户登录',
                    passed: loginSuccess,
                    url: currentUrl
                });
                console.log(`  ${loginSuccess ? '✅' : '❌'} 用户登录: ${currentUrl}`);
            }
        }
        
        console.log('📍 步骤4: 测试用户面板标签');
        const userTabs = [
            { selector: 'a[href="/dashboard"], .nav-item:has-text("仪表盘")', name: '仪表盘' },
            { selector: 'a[href="/chat"], .nav-item:has-text("对话")', name: '对话' },
            { selector: 'a[href="/intelligence"], .nav-item:has-text("智能")', name: '智能功能' },
            { selector: 'a[href="/review"], .nav-item:has-text("复习")', name: '记忆复习' },
            { selector: 'a[href="/knowledge"], .nav-item:has-text("知识库")', name: '知识库' },
            { selector: 'a[href="/visualization"], .nav-item:has-text("可视化")', name: '数据可视化' },
            { selector: 'a[href="/security"], .nav-item:has-text("安全")', name: '安全设置' },
            { selector: 'a[href="/profile"], .nav-item:has-text("资料")', name: '个人资料' }
        ];
        
        for (let i = 0; i < userTabs.length; i++) {
            const tab = userTabs[i];
            try {
                const tabElement = await page.$(tab.selector);
                if (tabElement) {
                    await tabElement.click();
                    await sleep(1500);
                    await takeScreenshot(page, `user_tab_${String(i + 4).padStart(2, '0')}_${tab.name}`);
                    console.log(`  ✅ 点击标签: ${tab.name}`);
                } else {
                    console.log(`  ⚠️ 标签未找到: ${tab.name}`);
                }
            } catch (error) {
                console.log(`  ❌ 标签点击失败: ${tab.name} - ${error.message}`);
            }
        }
        
    } catch (error) {
        results.issues.push({
            phase: 'User Flow',
            error: error.message,
            stack: error.stack
        });
        console.log(`❌ 用户流程测试失败: ${error.message}`);
    }
}

async function testAdminFlow(session) {
    console.log('\n=== Phase 4: 管理员流程测试 ===\n');
    const { page } = session;
    
    try {
        console.log('📍 步骤1: 访问管理员登录页面');
        await page.goto(`${CONFIG.baseUrl}/login`, { waitUntil: 'networkidle' });
        await sleep(1000);
        await takeScreenshot(page, 'admin_01_login_page');
        
        console.log('📍 步骤2: 填写管理员登录表单');
        const usernameInput = await page.$('input[name="username"], input[type="text"], #username');
        const passwordInput = await page.$('input[name="password"], input[type="password"], #password');
        const loginBtn = await page.$('button[type="submit"], .login-btn, #loginBtn');
        
        if (usernameInput && passwordInput) {
            await usernameInput.fill(CONFIG.users.admin.username);
            await passwordInput.fill(CONFIG.users.admin.password);
            await takeScreenshot(page, 'admin_02_login_filled');
            
            if (loginBtn) {
                console.log('📍 步骤3: 点击登录按钮');
                await loginBtn.click();
                await sleep(3000);
                await takeScreenshot(page, 'admin_03_after_login');
                
                const currentUrl = page.url();
                const loginSuccess = !currentUrl.includes('/login');
                results.tests.push({
                    phase: 'Admin Flow',
                    name: '管理员登录',
                    passed: loginSuccess,
                    url: currentUrl
                });
                console.log(`  ${loginSuccess ? '✅' : '❌'} 管理员登录: ${currentUrl}`);
            }
        }
        
        console.log('📍 步骤4: 访问管理员面板');
        await page.goto(`${CONFIG.baseUrl}/admin`, { waitUntil: 'networkidle' });
        await sleep(2000);
        await takeScreenshot(page, 'admin_04_admin_panel');
        
        console.log('📍 步骤5: 测试管理员面板标签');
        const adminTabs = [
            { selector: 'a[href="/admin"], .nav-item:has-text("控制台")', name: '控制台' },
            { selector: 'a[href="/admin/health"], .nav-item:has-text("健康")', name: '系统健康' },
            { selector: 'a[href="/admin/logs"], .nav-item:has-text("日志")', name: '日志审计' },
            { selector: 'a[href="/admin/users"], .nav-item:has-text("用户")', name: '用户管理' },
            { selector: 'a[href="/admin/permissions"], .nav-item:has-text("权限")', name: '权限管理' },
            { selector: 'a[href="/admin/providers"], .nav-item:has-text("提供商")', name: '提供商管理' },
            { selector: 'a[href="/admin/apikeys"], .nav-item:has-text("API")', name: 'API Key池' },
            { selector: 'a[href="/admin/autotasks"], .nav-item:has-text("任务")', name: '自动任务' },
            { selector: 'a[href="/admin/backups"], .nav-item:has-text("备份")', name: '备份管理' },
            { selector: 'a[href="/admin/announcements"], .nav-item:has-text("公告")', name: '公告管理' }
        ];
        
        for (let i = 0; i < adminTabs.length; i++) {
            const tab = adminTabs[i];
            try {
                const tabElement = await page.$(tab.selector);
                if (tabElement) {
                    await tabElement.click();
                    await sleep(1500);
                    await takeScreenshot(page, `admin_tab_${String(i + 5).padStart(2, '0')}_${tab.name}`);
                    console.log(`  ✅ 点击标签: ${tab.name}`);
                } else {
                    console.log(`  ⚠️ 标签未找到: ${tab.name}`);
                }
            } catch (error) {
                console.log(`  ❌ 标签点击失败: ${tab.name} - ${error.message}`);
            }
        }
        
    } catch (error) {
        results.issues.push({
            phase: 'Admin Flow',
            error: error.message,
            stack: error.stack
        });
        console.log(`❌ 管理员流程测试失败: ${error.message}`);
    }
}

async function testCRUDOperations(session) {
    console.log('\n=== Phase 5: CRUD 操作测试 ===\n');
    const { page } = session;
    
    try {
        console.log('📍 测试记忆创建 (Create)');
        await page.goto(`${CONFIG.baseUrl}/dashboard`, { waitUntil: 'networkidle' });
        await sleep(1000);
        
        const addBtn = await page.$('button:has-text("添加"), .add-btn, #addMemoryBtn');
        if (addBtn) {
            await addBtn.click();
            await sleep(1000);
            await takeScreenshot(page, 'crud_01_add_memory_modal');
            
            const contentInput = await page.$('textarea[name="content"], #memoryContent, .memory-input');
            if (contentInput) {
                await contentInput.fill('测试记忆内容 - Deep Inspector v8.46');
                await takeScreenshot(page, 'crud_02_memory_filled');
                console.log('  ✅ 记忆内容已填写');
            }
        }
        
        console.log('📍 测试记忆读取 (Read)');
        await page.goto(`${CONFIG.baseUrl}/knowledge`, { waitUntil: 'networkidle' });
        await sleep(1000);
        await takeScreenshot(page, 'crud_03_knowledge_page');
        
        const memoryItems = await page.$$('.memory-item, .knowledge-item, .list-item');
        console.log(`  📊 找到 ${memoryItems.length} 个记忆项`);
        
    } catch (error) {
        results.issues.push({
            phase: 'CRUD',
            error: error.message
        });
        console.log(`❌ CRUD测试失败: ${error.message}`);
    }
}

async function testMultiUserPermissions(session) {
    console.log('\n=== Phase 4.5: 多用户权限测试 ===\n');
    const { page } = session;
    
    try {
        console.log('📍 测试普通用户访问管理员页面');
        await page.goto(`${CONFIG.baseUrl}/login`, { waitUntil: 'networkidle' });
        await sleep(1000);
        
        const usernameInput = await page.$('input[name="username"], input[type="text"], #username');
        const passwordInput = await page.$('input[name="password"], input[type="password"], #password');
        const loginBtn = await page.$('button[type="submit"], .login-btn, #loginBtn');
        
        if (usernameInput && passwordInput && loginBtn) {
            await usernameInput.fill(CONFIG.users.user.username);
            await passwordInput.fill(CONFIG.users.user.password);
            await loginBtn.click();
            await sleep(3000);
            
            console.log('📍 尝试访问管理员面板');
            await page.goto(`${CONFIG.baseUrl}/admin`, { waitUntil: 'networkidle' });
            await sleep(2000);
            await takeScreenshot(page, 'permission_01_user_access_admin');
            
            const currentUrl = page.url();
            const accessDenied = currentUrl.includes('/login') || currentUrl.includes('/dashboard');
            
            results.tests.push({
                phase: 'Multi-User',
                name: '普通用户访问管理员页面被拒绝',
                passed: accessDenied,
                url: currentUrl
            });
            
            console.log(`  ${accessDenied ? '✅' : '❌'} 权限隔离测试: ${currentUrl}`);
        }
        
    } catch (error) {
        results.issues.push({
            phase: 'Multi-User',
            error: error.message
        });
        console.log(`❌ 多用户权限测试失败: ${error.message}`);
    }
}

async function runTests() {
    console.log('========================================');
    console.log('  远程深度检测 v8.46');
    console.log('  777-MS Memory System');
    console.log('========================================\n');
    
    ensureDir(CONFIG.screenshotsDir);
    
    await testAPI();
    
    console.log('\n🚀 启动浏览器进行交互测试...\n');
    
    let session;
    try {
        session = await playwrightGlobal.launch({
            project: '777-ms-remote-v846',
            headless: false,
            slowMo: 100
        });
        
        await testUserFlow(session);
        await testAdminFlow(session);
        await testCRUDOperations(session);
        await testMultiUserPermissions(session);
        
    } catch (error) {
        console.error('❌ 浏览器测试失败:', error.message);
        results.issues.push({
            phase: 'Browser',
            error: error.message,
            stack: error.stack
        });
    } finally {
        if (session) {
            await session.close();
        }
    }
    
    const reportPath = path.join(CONFIG.screenshotsDir, '..', 'REMOTE_DEEP_INSPECTION_V846_REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    
    console.log('\n========================================');
    console.log('  检测完成！');
    console.log(`  截图数量: ${results.screenshots.length}`);
    console.log(`  测试数量: ${results.tests.length}`);
    console.log(`  问题数量: ${results.issues.length}`);
    console.log(`  报告路径: ${reportPath}`);
    console.log('========================================\n');
    
    return results;
}

runTests().catch(console.error);
