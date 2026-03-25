const { playwrightGlobal } = require('D:\\playwright-data\\lib\\playwright-global.js');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.join(__dirname, 'deep-inspector-screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function takeScreenshot(page, name) {
    const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
    await page.screenshot({ path: filePath, fullPage: true });
    console.log(`✅ 截图保存: ${filePath}`);
    return filePath;
}

async function testLogin(page, username, password) {
    console.log(`\n🔐 测试登录: ${username}`);
    
    await page.goto('https://memory.91wz.org/login', { waitUntil: 'networkidle' });
    await takeScreenshot(page, '01_login_page');
    
    const usernameInput = await page.locator('input[name="username"], input[placeholder*="用户"], input[placeholder*="用户名"]').first();
    const passwordInput = await page.locator('input[type="password"], input[placeholder*="密码"]').first();
    const loginButton = await page.locator('button[type="submit"], button:has-text("登录"), button:has-text("登 录")').first();
    
    await usernameInput.fill(username);
    await takeScreenshot(page, '02_username_filled');
    
    await passwordInput.fill(password);
    await takeScreenshot(page, '03_password_filled');
    
    await loginButton.click();
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await takeScreenshot(page, '04_after_login');
    
    const currentUrl = page.url();
    console.log(`当前URL: ${currentUrl}`);
    
    return !currentUrl.includes('/login');
}

async function testDashboard(page) {
    console.log('\n📊 测试用户面板');
    
    await page.goto('https://memory.91wz.org/dashboard', { waitUntil: 'networkidle' });
    await takeScreenshot(page, '05_dashboard_home');
    
    const memoriesButton = await page.locator('a:has-text("记忆"), button:has-text("记忆")').first();
    if (await memoriesButton.isVisible()) {
        await memoriesButton.click();
        await page.waitForLoadState('networkidle');
        await takeScreenshot(page, '06_memories_page');
    }
    
    const knowledgeButton = await page.locator('a:has-text("知识"), button:has-text("知识")').first();
    if (await knowledgeButton.isVisible()) {
        await knowledgeButton.click();
        await page.waitForLoadState('networkidle');
        await takeScreenshot(page, '07_knowledge_page');
    }
    
    const chatButton = await page.locator('a:has-text("对话"), button:has-text("对话")').first();
    if (await chatButton.isVisible()) {
        await chatButton.click();
        await page.waitForLoadState('networkidle');
        await takeScreenshot(page, '08_chat_page');
    }
    
    const settingsButton = await page.locator('a:has-text("设置"), button:has-text("设置")').first();
    if (await settingsButton.isVisible()) {
        await settingsButton.click();
        await page.waitForLoadState('networkidle');
        await takeScreenshot(page, '09_settings_page');
    }
}

async function testCreateMemory(page) {
    console.log('\n📝 测试创建记忆');
    
    await page.goto('https://memory.91wz.org/dashboard', { waitUntil: 'networkidle' });
    await takeScreenshot(page, '10_dashboard_before_create');
    
    const createButton = await page.locator('button:has-text("新建"), button:has-text("添加"), button:has-text("创建")').first();
    if (await createButton.isVisible()) {
        await createButton.click();
        await page.waitForTimeout(1000);
        await takeScreenshot(page, '11_after_create_click');
        
        const contentInput = await page.locator('textarea, input[type="text"]').first();
        if (await contentInput.isVisible()) {
            await contentInput.fill('测试记忆内容 - 深度检测自动创建');
            await takeScreenshot(page, '12_memory_content_filled');
            
            const saveButton = await page.locator('button:has-text("保存"), button:has-text("提交"), button:has-text("确认")').first();
            if (await saveButton.isVisible()) {
                await saveButton.click();
                await page.waitForLoadState('networkidle');
                await takeScreenshot(page, '13_after_save');
            }
        }
    }
}

async function testChat(page) {
    console.log('\n💬 测试对话功能');
    
    await page.goto('https://memory.91wz.org/chat', { waitUntil: 'networkidle' });
    await takeScreenshot(page, '14_chat_page');
    
    const messageInput = await page.locator('textarea, input[type="text"]').first();
    if (await messageInput.isVisible()) {
        await messageInput.fill('你好,这是一个测试消息');
        await takeScreenshot(page, '15_message_filled');
        
        const sendButton = await page.locator('button:has-text("发送"), button:has-text("发送消息")').first();
        if (await sendButton.isVisible()) {
            await sendButton.click();
            await page.waitForTimeout(3000);
            await takeScreenshot(page, '16_after_send');
        }
    }
}

async function main() {
    console.log('🚀 开始深度检测 - Playwright真实交互测试\n');
    
    const session = await playwrightGlobal.launch({
        project: '777-ms-deep-inspector',
        headless: false,
        viewport: { width: 1920, height: 1080 }
    });
    
    const page = session.page;
    
    try {
        const loginSuccess = await testLogin(page, 'cccp', 'ck123456@');
        
        if (loginSuccess) {
            await testDashboard(page);
            await testCreateMemory(page);
            await testChat(page);
        } else {
            console.log('❌ 登录失败,跳过其他测试');
        }
        
        console.log('\n✅ 所有交互测试完成!');
        console.log(`📸 截图目录: ${SCREENSHOT_DIR}`);
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
        await takeScreenshot(page, 'error_screenshot');
    } finally {
        await session.close();
    }
}

main().catch(console.error);
