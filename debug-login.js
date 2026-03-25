/**
 * 登录问题调试脚本
 * 测试登录后跳转问题
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

async function takeScreenshot(page, name) {
    const filepath = path.join(SCREENSHOT_DIR, `debug_${name}.png`);
    await page.screenshot({ path: filepath, fullPage: false, timeout: 10000 });
    console.log(`📸 截图: ${name}`);
    return filepath;
}

async function debugLogin() {
    console.log('🔍 开始调试登录问题...\n');

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

        // 监听控制台日志
        page.on('console', msg => {
            console.log(`[浏览器] ${msg.type()}: ${msg.text()}`);
        });

        // 监听网络请求
        page.on('response', async response => {
            if (response.url().includes('/api/v1/user/login')) {
                try {
                    const data = await response.json();
                    console.log(`[API响应] 登录: success=${data.success}, message=${data.message}`);
                } catch (e) {}
            }
        });

        // 1. 打开登录页
        console.log('\n=== 步骤1: 打开登录页 ===');
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(2000);
        await takeScreenshot(page, '01_login_page');

        // 2. 检查localStorage
        console.log('\n=== 步骤2: 检查localStorage ===');
        const beforeToken = await page.evaluate(() => localStorage.getItem('token'));
        const beforeUser = await page.evaluate(() => localStorage.getItem('user'));
        console.log(`  登录前token: ${beforeToken ? '存在' : '不存在'}`);
        console.log(`  登录前user: ${beforeUser || '不存在'}`);

        // 清除旧的token
        if (beforeToken) {
            console.log('  清除旧token...');
            await page.evaluate(() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            });
        }

        // 3. 填写登录表单
        console.log('\n=== 步骤3: 填写登录表单 ===');
        const usernameInput = await page.$('input[name="username"], #username, input[type="text"]');
        const passwordInput = await page.$('input[name="password"], #password, input[type="password"]');
        
        if (usernameInput && passwordInput) {
            await usernameInput.fill(TEST_ACCOUNTS.user.username);
            await passwordInput.fill(TEST_ACCOUNTS.user.password);
            console.log(`  用户名: ${TEST_ACCOUNTS.user.username}`);
            console.log(`  密码: ${TEST_ACCOUNTS.user.password}`);
            await takeScreenshot(page, '02_login_filled');
        } else {
            console.log('  ❌ 未找到输入框');
            return;
        }

        // 4. 点击登录
        console.log('\n=== 步骤4: 点击登录按钮 ===');
        const loginBtn = await page.$('button[type="submit"], button');
        if (loginBtn) {
            await loginBtn.click();
            console.log('  已点击登录按钮');
        }

        // 5. 等待跳转
        console.log('\n=== 步骤5: 等待跳转 ===');
        await page.waitForTimeout(5000);
        await takeScreenshot(page, '03_after_login');

        // 6. 检查结果
        console.log('\n=== 步骤6: 检查结果 ===');
        const currentUrl = page.url();
        console.log(`  当前URL: ${currentUrl}`);

        const afterToken = await page.evaluate(() => localStorage.getItem('token'));
        const afterUser = await page.evaluate(() => localStorage.getItem('user'));
        console.log(`  登录后token: ${afterToken ? '存在' : '不存在'}`);
        if (afterToken) {
            console.log(`  Token前20字符: ${afterToken.substring(0, 20)}...`);
        }
        console.log(`  登录后user: ${afterUser || '不存在'}`);

        if (currentUrl.includes('dashboard')) {
            console.log('  ✅ 成功跳转到Dashboard');
        } else if (currentUrl.includes('login')) {
            console.log('  ❌ 仍在登录页');
            
            // 检查错误信息
            const errorDiv = await page.$('.error-message, .alert-error, [class*="error"]');
            if (errorDiv) {
                const errorText = await errorDiv.textContent();
                console.log(`  错误信息: ${errorText}`);
            }
        } else {
            console.log(`  ⚠️ 跳转到其他页面: ${currentUrl}`);
        }

        // 7. 手动测试API
        console.log('\n=== 步骤7: 手动测试API请求 ===');
        if (afterToken) {
            const apiResult = await page.evaluate(async (token) => {
                try {
                    const response = await fetch('/api/v1/memories', {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    const data = await response.json();
                    return { status: response.status, success: data.success, message: data.message };
                } catch (err) {
                    return { error: err.message };
                }
            }, afterToken);
            console.log(`  API响应: ${JSON.stringify(apiResult)}`);
        }

        // 保持浏览器打开一段时间
        console.log('\n=== 调试完成，浏览器保持打开10秒 ===');
        await page.waitForTimeout(10000);

    } catch (error) {
        console.error('❌ 调试过程出错:', error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

debugLogin().catch(console.error);
