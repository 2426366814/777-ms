/**
 * MCP 功能测试脚本
 * 使用 Chrome DevTools MCP 测试网站功能
 */

const { playwrightGlobal } = require('D:\\playwright-data\\lib\\playwright-global.js');
const fs = require('fs');
const path = require('path');

const CONFIG = {
    baseUrl: 'https://memory.91wz.org',
    screenshotsDir: path.join(__dirname, 'reports', 'screenshots', 'mcp_test'),
    users: {
        admin: { username: 'cccp', password: 'ck123456@' }
    }
};

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runMCPTest() {
    console.log('=== MCP 功能测试 ===\n');
    ensureDir(CONFIG.screenshotsDir);

    const session = await playwrightGlobal.launch({
        project: '777-ms-mcp-test',
        headless: false,
        slowMo: 100
    });

    const { page } = session;

    try {
        // 1. 登录页面
        console.log('📍 1. 访问登录页面');
        await page.goto(`${CONFIG.baseUrl}/login`, { waitUntil: 'networkidle' });
        await sleep(1500);
        await page.screenshot({ path: path.join(CONFIG.screenshotsDir, 'mcp_01_login.png'), fullPage: true });
        console.log('  📸 截图: mcp_01_login.png');

        // 2. 登录
        console.log('📍 2. 执行登录');
        await page.fill('input[name="username"], input[type="text"], #username', CONFIG.users.admin.username);
        await page.fill('input[name="password"], input[type="password"], #password', CONFIG.users.admin.password);
        await page.screenshot({ path: path.join(CONFIG.screenshotsDir, 'mcp_02_login_filled.png'), fullPage: true });
        console.log('  📸 截图: mcp_02_login_filled.png');

        await page.click('button[type="submit"], .login-btn, #loginBtn');
        await sleep(3000);
        await page.screenshot({ path: path.join(CONFIG.screenshotsDir, 'mcp_03_after_login.png'), fullPage: true });
        console.log('  📸 截图: mcp_03_after_login.png');

        // 3. 测试各页面
        const pagesToTest = [
            { url: '/dashboard', name: '仪表盘' },
            { url: '/review', name: '记忆复习' },
            { url: '/chat', name: '对话' },
            { url: '/knowledge', name: '知识库' },
            { url: '/visualization', name: '数据可视化' },
            { url: '/admin', name: '管理员面板' }
        ];

        for (let i = 0; i < pagesToTest.length; i++) {
            const p = pagesToTest[i];
            console.log(`📍 ${i + 4}. 测试 ${p.name}`);
            try {
                await page.goto(`${CONFIG.baseUrl}${p.url}`, { waitUntil: 'networkidle', timeout: 20000 });
                await sleep(2000);
                const filename = `mcp_${String(i + 4).padStart(2, '0')}_${p.name}.png`;
                await page.screenshot({ path: path.join(CONFIG.screenshotsDir, filename), fullPage: true });
                console.log(`  📸 截图: ${filename}`);
            } catch (error) {
                console.log(`  ❌ 访问失败: ${error.message}`);
            }
        }

        // 4. 测试复习功能交互
        console.log('\n📍 测试复习功能交互');
        await page.goto(`${CONFIG.baseUrl}/review`, { waitUntil: 'networkidle' });
        await sleep(2000);

        // 点击开始复习
        const startBtn = await page.$('button:has-text("开始复习"), .start-review-btn');
        if (startBtn) {
            console.log('  点击开始复习按钮');
            await startBtn.click();
            await sleep(2000);
            await page.screenshot({ path: path.join(CONFIG.screenshotsDir, 'mcp_99_review_started.png'), fullPage: true });
            console.log('  📸 截图: mcp_99_review_started.png');
        }

        // 测试复习卡片交互
        const cards = await page.$$('.review-card, .memory-card, .card');
        console.log(`  找到 ${cards.length} 个复习卡片`);

        if (cards.length > 0) {
            // 点击第一个卡片的"记得"按钮
            const rememberBtn = await page.$('button:has-text("记得"), .remember-btn');
            if (rememberBtn) {
                console.log('  点击"记得"按钮');
                await rememberBtn.click();
                await sleep(1500);
                await page.screenshot({ path: path.join(CONFIG.screenshotsDir, 'mcp_98_after_remember.png'), fullPage: true });
                console.log('  📸 截图: mcp_98_after_remember.png');
            }
        }

        console.log('\n=== MCP 测试完成 ===');
        console.log(`截图保存位置: ${CONFIG.screenshotsDir}`);

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    } finally {
        await session.close();
    }
}

runMCPTest().catch(console.error);
