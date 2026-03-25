/**
 * Deep Inspector v8.50 - 远程完整深度测试
 * 测试目标: https://memory.91wz.org
 * 测试内容: 管理员面板 + 用户面板 + 滑出面板功能
 */

const { playwrightGlobal } = require('D:\\playwright-data\\lib\\playwright-global.js');
const fs = require('fs');
const path = require('path');

const CONFIG = {
    baseUrl: 'https://memory.91wz.org',
    adminUser: { username: 'admintest', password: 'Admin@123456' },
    normalUser: { username: 'test', password: 'test123456' },
    screenshotDir: path.join(__dirname, 'reports', 'screenshots', 'v850'),
    timeout: 30000
};

const adminTabs = [
    { name: '控制台', selector: '.nav-item[data-nav=""]' },
    { name: '系统健康', selector: '.nav-item[data-nav="health"]' },
    { name: '日志审计', selector: '.nav-item[data-nav="logs"]' },
    { name: '用户管理', selector: '.nav-item[data-nav="users"]' },
    { name: '权限管理', selector: '.nav-item[data-nav="permissions"]' },
    { name: '提供商管理', selector: '.nav-item[data-nav="providers"]' },
    { name: 'API Key 池', selector: '.nav-item[data-nav="apikeys"]' },
    { name: '自动任务', selector: '.nav-item[data-nav="autotasks"]' },
    { name: '备份管理', selector: '.nav-item[data-nav="backups"]' },
    { name: '公告管理', selector: '.nav-item[data-nav="announcements"]' }
];

const userTabs = [
    { name: '仪表盘', selector: 'a[href="/dashboard"]' },
    { name: '记忆列表', selector: 'a[href="/memories"]' },
    { name: 'API密钥', selector: 'a[href="/api-keys"]' },
    { name: '个人设置', selector: 'a[href="/settings"]' }
];

let testResults = {
    passed: 0,
    failed: 0,
    errors: [],
    screenshots: []
};

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

async function takeScreenshot(page, name) {
    try {
        const filePath = path.join(CONFIG.screenshotDir, `${name}.png`);
        await page.screenshot({ path: filePath, fullPage: false, timeout: 10000 });
        testResults.screenshots.push({ name, path: filePath });
        console.log(`  📸 截图: ${name}.png`);
        return filePath;
    } catch (error) {
        console.log(`  ⚠️ 截图失败: ${name} - ${error.message}`);
        return null;
    }
}

async function login(page, user) {
    console.log(`\n🔐 登录: ${user.username}`);
    
    // 先清除登录状态
    await page.context().clearCookies();
    await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
    });
    
    console.log('  🧹 已清除登录状态');
    
    // 直接访问登录页面
    console.log('  📍 访问登录页面...');
    await page.goto(CONFIG.baseUrl + '/login', { timeout: 90000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // 等待登录表单出现
    try {
        await page.waitForSelector('#username', { timeout: 10000 });
        console.log('  ✅ 登录表单已加载');
    } catch (e) {
        console.log('  ⚠️ 登录表单未找到，尝试等待更长时间...');
        await page.waitForTimeout(3000);
    }
    
    const usernameInput = await page.$('#username');
    if (!usernameInput) {
        console.log('  ❌ 登录表单未找到');
        await takeScreenshot(page, 'login_form_not_found');
        return;
    }
    
    await page.fill('#username', user.username);
    await page.fill('#password', user.password);
    await page.click('button[type="submit"]');
    
    console.log(`  ⏳ 等待登录跳转...`);
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log(`  📍 当前URL: ${currentUrl}`);
    
    if (user.username === CONFIG.adminUser.username) {
        if (currentUrl.includes('/admin')) {
            console.log(`  ✅ 管理员登录成功，已跳转到管理面板`);
        } else {
            console.log(`  ⚠️ 管理员登录后未跳转到管理面板，尝试手动跳转...`);
            await page.goto(CONFIG.baseUrl + '/admin');
            await page.waitForTimeout(2000);
        }
    } else {
        if (currentUrl.includes('/dashboard')) {
            console.log(`  ✅ 普通用户登录成功，已跳转到用户面板`);
        }
    }
    
    await takeScreenshot(page, `${user.username}_after_login`);
}

async function testAdminTabs(page) {
    console.log('\n📋 测试管理员面板标签...');
    
    for (const tab of adminTabs) {
        try {
            console.log(`\n  🔍 测试标签: ${tab.name}`);
            
            const tabElement = await page.$(tab.selector);
            if (!tabElement) {
                console.log(`  ⚠️ 标签未找到: ${tab.name}`);
                testResults.errors.push({ tab: tab.name, error: '标签未找到' });
                continue;
            }
            
            await tabElement.click();
            await page.waitForTimeout(1000);
            await takeScreenshot(page, `admin_${tab.name.replace(/\s+/g, '_')}`);
            
            console.log(`  ✅ 标签点击成功: ${tab.name}`);
            testResults.passed++;
        } catch (error) {
            console.log(`  ❌ 标签测试失败: ${tab.name} - ${error.message}`);
            testResults.failed++;
            testResults.errors.push({ tab: tab.name, error: error.message });
        }
    }
}

async function testUserManagementPanel(page) {
    console.log('\n👥 测试用户管理滑出面板...');
    
    try {
        await page.click('.nav-item[data-nav="users"]');
        await page.waitForTimeout(1000);
        await takeScreenshot(page, 'admin_user_management_list');
        
        const editButtons = await page.$$('button[data-action="edit-user"]');
        console.log(`  📊 找到 ${editButtons.length} 个用户编辑按钮`);
        
        if (editButtons.length > 0) {
            await editButtons[0].click();
            await page.waitForTimeout(1000);
            await takeScreenshot(page, 'admin_user_slide_panel_open');
            
            const slidePanel = await page.$('.slide-panel.active');
            if (slidePanel) {
                console.log('  ✅ 滑出面板成功打开');
                testResults.passed++;
                
                const closeBtn = await page.$('#closePanelBtn');
                if (closeBtn) {
                    await closeBtn.click();
                    await page.waitForTimeout(500);
                    await takeScreenshot(page, 'admin_user_slide_panel_closed');
                    console.log('  ✅ 滑出面板成功关闭');
                    testResults.passed++;
                }
            } else {
                console.log('  ❌ 滑出面板未打开');
                testResults.failed++;
                testResults.errors.push({ tab: '用户管理面板', error: '滑出面板未打开' });
            }
        }
    } catch (error) {
        console.log(`  ❌ 用户管理面板测试失败: ${error.message}`);
        testResults.failed++;
        testResults.errors.push({ tab: '用户管理面板', error: error.message });
    }
}

async function testAddUserPanel(page) {
    console.log('\n➕ 测试添加用户滑出面板...');
    
    try {
        await page.click('.nav-item[data-nav="users"]');
        await page.waitForTimeout(500);
        
        const addBtn = await page.$('#showAddUserBtn');
        if (addBtn) {
            await addBtn.click();
            await page.waitForTimeout(1000);
            await takeScreenshot(page, 'admin_add_user_panel_open');
            
            const panelTitle = await page.$eval('#panelTitle', el => el.textContent);
            if (panelTitle === '添加用户') {
                console.log('  ✅ 添加用户面板正确显示');
                testResults.passed++;
            }
            
            const passwordGroup = await page.$('#passwordGroup');
            if (passwordGroup) {
                const isVisible = await passwordGroup.isVisible();
                console.log(`  ${isVisible ? '✅' : '❌'} 密码输入框${isVisible ? '可见' : '不可见'}`);
            }
            
            const closeBtn = await page.$('#closePanelBtn');
            if (closeBtn) {
                await closeBtn.click();
                await page.waitForTimeout(500);
            }
        }
    } catch (error) {
        console.log(`  ❌ 添加用户面板测试失败: ${error.message}`);
        testResults.failed++;
        testResults.errors.push({ tab: '添加用户面板', error: error.message });
    }
}

async function testUserTabs(page) {
    console.log('\n👤 测试普通用户面板标签...');
    
    for (const tab of userTabs) {
        try {
            console.log(`\n  🔍 测试标签: ${tab.name}`);
            
            const tabElement = await page.$(tab.selector);
            if (!tabElement) {
                console.log(`  ⚠️ 标签未找到: ${tab.name}`);
                continue;
            }
            
            await tabElement.click();
            await page.waitForTimeout(1000);
            await takeScreenshot(page, `user_${tab.name.replace(/\s+/g, '_')}`);
            
            console.log(`  ✅ 标签点击成功: ${tab.name}`);
            testResults.passed++;
        } catch (error) {
            console.log(`  ❌ 标签测试失败: ${tab.name} - ${error.message}`);
            testResults.failed++;
            testResults.errors.push({ tab: tab.name, error: error.message });
        }
    }
}

async function runTests() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Deep Inspector v8.50 - 远程完整深度测试');
    console.log('  目标: ' + CONFIG.baseUrl);
    console.log('═══════════════════════════════════════════════════════════');
    
    ensureDir(CONFIG.screenshotDir);
    
    let session;
    
    try {
        session = await playwrightGlobal.launch({
            project: 'deep-inspector-v850',
            headless: false
        });
        
        const page = session.page;
        
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('  第一部分: 管理员面板测试');
        console.log('═══════════════════════════════════════════════════════════');
        
        await login(page, CONFIG.adminUser);
        await takeScreenshot(page, 'admin_dashboard');
        
        await testAdminTabs(page);
        await testUserManagementPanel(page);
        await testAddUserPanel(page);
        
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('  第二部分: 普通用户面板测试');
        console.log('═══════════════════════════════════════════════════════════');
        
        await page.click('#logoutBtn');
        await page.waitForTimeout(1000);
        
        await login(page, CONFIG.normalUser);
        await takeScreenshot(page, 'user_dashboard');
        
        await testUserTabs(page);
        
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('  测试结果汇总');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`  ✅ 通过: ${testResults.passed}`);
        console.log(`  ❌ 失败: ${testResults.failed}`);
        console.log(`  📸 截图: ${testResults.screenshots.length} 张`);
        
        if (testResults.errors.length > 0) {
            console.log('\n  ⚠️ 错误详情:');
            testResults.errors.forEach((err, i) => {
                console.log(`    ${i + 1}. ${err.tab}: ${err.error}`);
            });
        }
        
        const reportPath = path.join(__dirname, 'reports', 'DEEP_TEST_V850_REPORT.md');
        const reportContent = generateReport();
        fs.writeFileSync(reportPath, reportContent, 'utf8');
        console.log(`\n  📄 报告已生成: ${reportPath}`);
        
    } catch (error) {
        console.error('\n❌ 测试执行失败:', error.message);
        testResults.errors.push({ tab: '全局', error: error.message });
    } finally {
        if (session) {
            await session.close();
        }
    }
    
    return testResults;
}

function generateReport() {
    const now = new Date().toLocaleString('zh-CN');
    
    return `# Deep Inspector v8.50 测试报告

## 测试信息

- **测试时间**: ${now}
- **测试目标**: ${CONFIG.baseUrl}
- **测试版本**: v8.50

## 测试结果

| 指标 | 数量 |
|------|------|
| ✅ 通过 | ${testResults.passed} |
| ❌ 失败 | ${testResults.failed} |
| 📸 截图 | ${testResults.screenshots.length} |

## 截图列表

${testResults.screenshots.map(s => `- ${s.name}`).join('\n')}

## 错误详情

${testResults.errors.length > 0 
    ? testResults.errors.map((e, i) => `${i + 1}. **${e.tab}**: ${e.error}`).join('\n')
    : '无错误'}

## 测试状态

${testResults.failed === 0 ? '✅ **全部测试通过**' : '⚠️ **存在测试失败**'}
`;
}

runTests().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
});
