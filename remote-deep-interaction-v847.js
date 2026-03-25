const { playwrightGlobal } = require('D:\\playwright-data\\lib\\playwright-global.js');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, 'reports', 'screenshots', 'remote_v847');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(message) {
  console.log('[' + new Date().toISOString() + '] ' + message);
}

async function takeScreenshot(page, name) {
  const screenshotPath = path.join(SCREENSHOT_DIR, name + '.png');
  try {
    await page.screenshot({ path: screenshotPath, fullPage: false, timeout: 10000 });
    log('✓ 截图已保存：' + name + '.png');
    return screenshotPath;
  } catch (error) {
    log('✗ 截图失败：' + error.message);
    return null;
  }
}

async function runDeepInspection() {
  log('========== 777-MS 远程真实交互深度检测 v8.47 ==========');
  
  let session;
  try {
    log('正在启动 Playwright 全局库...');
    session = await playwrightGlobal.launch({
      project: '777-ms-remote',
      headless: false,
    });
    
    const { page, browser } = session;
    log('✓ 浏览器已启动');
    
    const BASE_URL = 'https://memory.91wz.org';
    
    log('\n===== Phase 1: 首页测试 =====');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    await takeScreenshot(page, '01_homepage');
    log('✓ 首页加载完成');
    
    log('\n===== Phase 2: 登录页测试 =====');
    await page.goto(BASE_URL + '/login.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    await takeScreenshot(page, '02_login_page');
    log('✓ 登录页加载完成');
    
    // 尝试填写登录表单
    try {
      const usernameInput = await page.$('input[name="username"], input[type="text"]');
      if (usernameInput) {
        await usernameInput.fill('test_user');
        log('✓ 用户名已填写');
        await takeScreenshot(page, '03_login_filled');
      }
    } catch (error) {
      log('✗ 填写用户名失败：' + error.message);
    }
    
    log('\n===== Phase 3: 用户面板测试 =====');
    const userPages = [
      '/dashboard.html',
      '/chat.html', 
      '/intelligence.html',
      '/review.html',
      '/knowledge.html',
      '/visualization.html',
      '/security.html',
      '/providers.html',
      '/profile.html'
    ];
    
    for (const pagePath of userPages) {
      try {
        log('访问：' + pagePath);
        await page.goto(BASE_URL + pagePath, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(1000);
        const pageName = path.basename(pagePath, '.html');
        await takeScreenshot(page, 'user_' + pageName);
        
        // 尝试点击页面中的按钮
        const buttons = await page.$$('button:not([disabled]), a.btn, [role="button"]');
        for (let i = 0; i < Math.min(buttons.length, 3); i++) {
          try {
            await buttons[i].scrollIntoViewIfNeeded();
            await buttons[i].click({ timeout: 2000 });
            await sleep(500);
            await takeScreenshot(page, 'user_' + pageName + '_btn' + i);
          } catch (e) {
            // 忽略按钮点击错误
          }
        }
      } catch (error) {
        log('✗ 访问 ' + pagePath + ' 失败：' + error.message);
      }
    }
    
    log('\n===== Phase 4: 管理员面板测试 =====');
    const adminPages = [
      '/admin.html',
      '/admin.html#users',
      '/admin.html#health',
      '/admin.html#logs',
      '/admin.html#backups'
    ];
    
    for (const pagePath of adminPages) {
      try {
        log('访问：' + pagePath);
        await page.goto(BASE_URL + pagePath, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(1000);
        const pageName = 'admin_' + path.basename(pagePath, '.html').replace('#', '_');
        await takeScreenshot(page, pageName);
      } catch (error) {
        log('✗ 访问 ' + pagePath + ' 失败：' + error.message);
      }
    }
    
    log('\n========== 检测完成 ==========');
    log('✓ 所有测试已完成');
    
  } catch (error) {
    log('✗ 错误：' + error.message);
    throw error;
  } finally {
    if (session) {
      await session.close();
      log('浏览器会话已关闭');
    }
  }
}

runDeepInspection().then(() => {
  log('✓ 检测成功完成');
  process.exit(0);
}).catch(error => {
  log('✗ 检测失败：' + error.message);
  process.exit(1);
});
