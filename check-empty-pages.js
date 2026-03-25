/**
 * 页面截图检查脚本
 * 检查记忆复习和其他功能的空转/空白问题
 */

const { playwrightGlobal } = require('D:\\playwright-data\\lib\\playwright-global.js');
const fs = require('fs');
const path = require('path');

const CONFIG = {
    baseUrl: 'https://memory.91wz.org',
    screenshotsDir: path.join(__dirname, 'reports', 'screenshots', 'check_empty'),
    users: {
        admin: { username: 'cccp', password: 'ck123456@' },
        user: { username: '2426366814', password: 'ck123456@' }
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

async function checkPages() {
    console.log('=== 开始页面截图检查 ===\n');
    ensureDir(CONFIG.screenshotsDir);

    const session = await playwrightGlobal.launch({
        project: '777-ms-check-empty',
        headless: false,
        slowMo: 50
    });

    const { page } = session;
    const results = [];

    try {
        // 1. 登录页面
        console.log('📍 1. 访问登录页面');
        await page.goto(`${CONFIG.baseUrl}/login`, { waitUntil: 'networkidle' });
        await sleep(1500);
        await page.screenshot({ path: path.join(CONFIG.screenshotsDir, '01_login.png'), fullPage: true });
        console.log('  📸 截图: 01_login.png');

        // 2. 登录
        console.log('📍 2. 登录');
        const usernameInput = await page.$('input[name="username"], input[type="text"], #username');
        const passwordInput = await page.$('input[name="password"], input[type="password"], #password');
        const loginBtn = await page.$('button[type="submit"], .login-btn, #loginBtn');

        if (usernameInput && passwordInput && loginBtn) {
            await usernameInput.fill(CONFIG.users.admin.username);
            await passwordInput.fill(CONFIG.users.admin.password);
            await loginBtn.click();
            await sleep(3000);
            await page.screenshot({ path: path.join(CONFIG.screenshotsDir, '02_after_login.png'), fullPage: true });
            console.log('  📸 截图: 02_after_login.png');
        }

        // 3. 检查各个页面
        const pagesToCheck = [
            { url: '/dashboard', name: '仪表盘' },
            { url: '/review', name: '记忆复习' },
            { url: '/chat', name: '对话' },
            { url: '/knowledge', name: '知识库' },
            { url: '/visualization', name: '数据可视化' },
            { url: '/security', name: '安全设置' },
            { url: '/profile', name: '个人资料' },
            { url: '/admin', name: '管理员面板' },
            { url: '/admin/health', name: '系统健康' },
            { url: '/admin/users', name: '用户管理' }
        ];

        for (let i = 0; i < pagesToCheck.length; i++) {
            const p = pagesToCheck[i];
            console.log(`📍 ${i + 3}. 检查 ${p.name}`);
            try {
                await page.goto(`${CONFIG.baseUrl}${p.url}`, { waitUntil: 'networkidle', timeout: 15000 });
                await sleep(2000);
                const filename = `${String(i + 3).padStart(2, '0')}_${p.name.replace(/\//g, '_')}.png`;
                await page.screenshot({ path: path.join(CONFIG.screenshotsDir, filename), fullPage: true });
                console.log(`  📸 截图: ${filename}`);

                // 检查是否有空白内容
                const content = await page.content();
                const hasEmptyState = content.includes('暂无') || content.includes('没有') || content.includes('空') || content.includes('empty');
                const hasData = content.includes('记忆') || content.includes('复习') || content.includes('数据');

                results.push({
                    page: p.name,
                    url: p.url,
                    hasEmptyState,
                    hasData,
                    status: hasEmptyState && !hasData ? '可能空白' : '有内容'
                });
            } catch (error) {
                console.log(`  ❌ 访问失败: ${error.message}`);
                results.push({
                    page: p.name,
                    url: p.url,
                    error: error.message,
                    status: '访问失败'
                });
            }
        }

        // 4. 特别检查复习页面的交互元素
        console.log('\n📍 检查复习页面交互元素');
        await page.goto(`${CONFIG.baseUrl}/review`, { waitUntil: 'networkidle' });
        await sleep(2000);

        // 尝试点击开始复习按钮
        const startReviewBtn = await page.$('button:has-text("开始复习"), .start-review-btn, #startReviewBtn');
        if (startReviewBtn) {
            console.log('  找到开始复习按钮，点击...');
            await startReviewBtn.click();
            await sleep(2000);
            await page.screenshot({ path: path.join(CONFIG.screenshotsDir, '99_review_started.png'), fullPage: true });
            console.log('  📸 截图: 99_review_started.png');
        }

        // 检查复习卡片
        const reviewCards = await page.$$('.review-card, .memory-card, .card');
        console.log(`  找到 ${reviewCards.length} 个复习卡片`);

        // 检查统计数字
        const statsText = await page.$eval('.stats, .statistics, .review-stats', el => el?.textContent || '无统计').catch(() => '无统计元素');
        console.log(`  统计信息: ${statsText.substring(0, 100)}`);

    } catch (error) {
        console.error('❌ 检查失败:', error.message);
    } finally {
        await session.close();
    }

    // 输出结果
    console.log('\n=== 检查结果 ===');
    results.forEach(r => {
        console.log(`${r.status === '有内容' ? '✅' : r.status === '可能空白' ? '⚠️' : '❌'} ${r.page}: ${r.status}`);
    });

    console.log(`\n截图保存位置: ${CONFIG.screenshotsDir}`);
}

checkPages().catch(console.error);
