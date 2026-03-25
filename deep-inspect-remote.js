
const { playwrightGlobal } = require('D:\\playwright-data\\lib\\playwright-global.js');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, 'reports', 'screenshots', 'remote_v843');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise(resolve =&gt; setTimeout(resolve, ms));
}

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function takeScreenshot(page, name) {
  const screenshotPath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  log(`✓ 截图已保存: ${name}.png`);
  return screenshotPath;
}

async function runDeepInspection() {
  log('========== 777-MS 远程真实交互深度检测 v8.43 ==========');
  
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
    
    // ===== Phase 1: 首页测试 =====
    log('\n===== Phase 1: 首页测试 =====');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    await takeScreenshot(page, '01_homepage');
    log('✓ 首页加载完成');
    
    // ===== Phase 2: 登录页测试 =====
    log('\n===== Phase 2: 登录页测试 =====');
    await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    await takeScreenshot(page, '02_login_page');
    log('✓ 登录页加载完成');
    
    // ===== Phase 3: 用户登录测试 =====
    log('\n===== Phase 3: 用户登录测试 =====');
    await page.fill('input[name="username"]', '2426366814');
    await page.fill('input[name="password"]', 'ck123456@');
    await takeScreenshot(page, '03_login_form_filled');
    
    await page.click('button[type="submit"]');
    await sleep(3000);
    await takeScreenshot(page, '04_after_login');
    log('✓ 用户登录完成');
    
    // ===== Phase 4: 仪表板测试 =====
    log('\n===== Phase 4: 仪表板测试 =====');
    await page.goto(`${BASE_URL}/dashboard.html`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(3000);
    await takeScreenshot(page, '05_dashboard');
    log('✓ 仪表板加载完成');
    
    // ===== Phase 5: 聊天页面测试 =====
    log('\n===== Phase 5: 聊天页面测试 =====');
    await page.goto(`${BASE_URL}/chat.html`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(3000);
    await takeScreenshot(page, '06_chat');
    log('✓ 聊天页面加载完成');
    
    // ===== Phase 6: 智能分析页面测试 =====
    log('\n===== Phase 6: 智能分析页面测试 =====');
    await page.goto(`${BASE_URL}/intelligence.html`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(3000);
    await takeScreenshot(page, '07_intelligence');
    log('✓ 智能分析页面加载完成');
    
    // ===== Phase 7: 知识库页面测试 =====
    log('\n===== Phase 7: 知识库页面测试 =====');
    await page.goto(`${BASE_URL}/knowledge.html`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(3000);
    await takeScreenshot(page, '08_knowledge');
    log('✓ 知识库页面加载完成');
    
    // ===== Phase 8: 复习页面测试 =====
    log('\n===== Phase 8: 复习页面测试 =====');
    await page.goto(`${BASE_URL}/review.html`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(3000);
    await takeScreenshot(page, '09_review');
    log('✓ 复习页面加载完成');
    
    // ===== Phase 9: 可视化页面测试 =====
    log('\n===== Phase 9: 可视化页面测试 =====');
    await page.goto(`${BASE_URL}/visualization.html`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(3000);
    await takeScreenshot(page, '10_visualization');
    log('✓ 可视化页面加载完成');
    
    // ===== Phase 10: 安全页面测试 =====
    log('\n===== Phase 10: 安全页面测试 =====');
    await page.goto(`${BASE_URL}/security.html`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(3000);
    await takeScreenshot(page, '11_security');
    log('✓ 安全页面加载完成');
    
    // ===== Phase 11: 供应商页面测试 =====
    log('\n===== Phase 11: 供应商页面测试 =====');
    await page.goto(`${BASE_URL}/providers.html`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(3000);
    await takeScreenshot(page, '12_providers');
    log('✓ 供应商页面加载完成');
    
    // ===== Phase 12: 个人资料页面测试 =====
    log('\n===== Phase 12: 个人资料页面测试 =====');
    await page.goto(`${BASE_URL}/profile.html`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(3000);
    await takeScreenshot(page, '13_profile');
    log('✓ 个人资料页面加载完成');
    
    // ===== Phase 13: 登出测试 =====
    log('\n===== Phase 13: 登出测试 =====');
    await page.evaluate(() =&gt; {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    await takeScreenshot(page, '14_logout');
    log('✓ 登出完成');
    
    // ===== Phase 14: 管理员登录测试 =====
    log('\n===== Phase 14: 管理员登录测试 =====');
    await page.fill('input[name="username"]', 'cccp');
    await page.fill('input[name="password"]', 'ck123456@');
    await takeScreenshot(page, '15_admin_login_form');
    await page.click('button[type="submit"]');
    await sleep(3000);
    await takeScreenshot(page, '16_admin_logged_in');
    log('✓ 管理员登录完成');
    
    // ===== Phase 15: 管理员面板测试 =====
    log('\n===== Phase 15: 管理员面板测试 =====');
    await page.goto(`${BASE_URL}/admin.html`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(3000);
    await takeScreenshot(page, '17_admin_panel');
    log('✓ 管理员面板加载完成');
    
    log('\n========== 所有测试完成！ ==========');
    log(`✓ 截图已保存到: ${SCREENSHOT_DIR}`);
    
    await sleep(3000);
    await session.close();
    
    return {
      success: true,
      screenshotDir: SCREENSHOT_DIR,
      screenshots: fs.readdirSync(SCREENSHOT_DIR)
    };
    
  } catch (error) {
    log(`✗ 错误: ${error.message}`);
    console.error(error);
    
    if (session) {
      try {
        await session.close();
      } catch (e) {
        console.error('关闭会话时出错:', e);
      }
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

runDeepInspection().then(result =&gt; {
  console.log('\n========== 检测结果 ==========');
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
});

