const { playwrightGlobal } = require('D:\\playwright-data\\lib\\playwright-global.js');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, 'reports', 'screenshots', 'real_click_test_v849');

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
  await page.screenshot({ path: screenshotPath, fullPage: true });
  log('截图已保存: ' + name + '.png');
  return screenshotPath;
}

async function runRealClickTest() {
  log('========== 777-MS 真实点击深度测试 v8.49 ==========');
  
  let session;
  const results = {
    admin: { tabs: [], errors: [] },
    user: { tabs: [], errors: [] }
  };
  
  try {
    log('正在启动 Playwright 全局库...');
    session = await playwrightGlobal.launch({
      project: '777-ms-real-click-test',
      headless: false,
    });
    
    const { page } = session;
    log('浏览器已启动');
    
    const BASE_URL = 'https://memory.91wz.org';
    
    // ========== 管理员用户测试 ==========
    log('\n========== 管理员用户真实点击测试 ==========');
    
    // 登录管理员
    log('\n--- 管理员登录 ---');
    await page.goto(BASE_URL + '/login.html', { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    await takeScreenshot(page, 'admin_01_login_page');
    
    // 填写登录表单
    const usernameInput = await page.$('input[name="username"], input[placeholder*="用户名"], input[placeholder*="请输入用户名"]');
    const passwordInput = await page.$('input[type="password"], input[placeholder*="密码"]');
    
    if (usernameInput) await usernameInput.fill('cccp');
    if (passwordInput) await passwordInput.fill('ck123456@');
    await takeScreenshot(page, 'admin_02_login_filled');
    
    const loginBtn = await page.$('button[type="submit"], button:has-text("登录")');
    if (loginBtn) await loginBtn.click();
    await sleep(3000);
    await takeScreenshot(page, 'admin_03_after_login');
    log('管理员登录完成');
    
    // 导航到管理员面板
    log('\n--- 导航到管理员面板 ---');
    await page.goto(BASE_URL + '/admin.html', { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(3000);
    await takeScreenshot(page, 'admin_04_admin_panel');
    
    // ========== 真实点击每个管理员标签 ==========
    log('\n--- 真实点击管理员标签测试 ---');
    
    // 定义所有管理员标签选择器
    const adminTabs = [
      { name: '控制台', selector: 'a:has-text("控制台"), button:has-text("控制台"), [href*="console"], [data-tab="console"]' },
      { name: '系统健康', selector: 'a:has-text("系统健康"), button:has-text("系统健康"), [href*="health"], [data-tab="health"]' },
      { name: '日志审计', selector: 'a:has-text("日志审计"), button:has-text("日志审计"), [href*="log"], [data-tab="logs"]' },
      { name: '用户管理', selector: 'a:has-text("用户管理"), button:has-text("用户管理"), [href*="user"], [data-tab="users"]' },
      { name: '权限管理', selector: 'a:has-text("权限管理"), button:has-text("权限管理"), [href*="permission"], [data-tab="permissions"]' },
      { name: '提供商管理', selector: 'a:has-text("提供商管理"), button:has-text("提供商管理"), [href*="provider"], [data-tab="providers"]' },
      { name: 'API Key 池', selector: 'a:has-text("API Key"), button:has-text("API Key"), [href*="apikey"], [data-tab="apikeys"]' },
      { name: '自动任务', selector: 'a:has-text("自动任务"), button:has-text("自动任务"), [href*="task"], [data-tab="tasks"]' },
      { name: '备份管理', selector: 'a:has-text("备份管理"), button:has-text("备份管理"), [href*="backup"], [data-tab="backup"]' },
      { name: '公告管理', selector: 'a:has-text("公告管理"), button:has-text("公告管理"), [href*="announcement"], [data-tab="announcements"]' }
    ];
    
    for (let i = 0; i < adminTabs.length; i++) {
      const tab = adminTabs[i];
      log('\n尝试点击标签: ' + tab.name);
      
      try {
        // 先截图当前状态
        await takeScreenshot(page, 'admin_before_click_' + tab.name);
        
        // 尝试多种选择器
        let tabElement = null;
        const selectors = tab.selector.split(', ');
        
        for (const selector of selectors) {
          tabElement = await page.$(selector);
          if (tabElement) {
            log('找到元素: ' + selector);
            break;
          }
        }
        
        if (tabElement) {
          // 滚动到元素可见
          await tabElement.scrollIntoViewIfNeeded();
          await sleep(500);
          
          // 真实点击
          await tabElement.click();
          log('已点击: ' + tab.name);
          
          // 等待页面响应
          await sleep(2000);
          
          // 截图点击后状态
          await takeScreenshot(page, 'admin_after_click_' + tab.name);
          
          // 检查页面内容是否变化
          const pageContent = await page.content();
          const hasContent = pageContent.length > 0;
          
          results.admin.tabs.push({
            name: tab.name,
            status: 'clicked',
            elementFound: true,
            hasContent: hasContent
          });
          
          log('标签 ' + tab.name + ' 点击成功，内容长度: ' + pageContent.length);
        } else {
          log('未找到标签元素: ' + tab.name);
          results.admin.errors.push({
            tab: tab.name,
            error: '元素未找到',
            selectors: selectors
          });
          
          // 截图当前页面状态
          await takeScreenshot(page, 'admin_error_not_found_' + tab.name);
        }
      } catch (error) {
        log('点击标签 ' + tab.name + ' 时出错: ' + error.message);
        results.admin.errors.push({
          tab: tab.name,
          error: error.message
        });
        
        await takeScreenshot(page, 'admin_error_click_' + tab.name);
      }
    }
    
    // ========== 获取页面所有可点击元素 ==========
    log('\n--- 获取页面所有可点击元素 ---');
    
    const allLinks = await page.$$('a');
    const allButtons = await page.$$('button');
    const allClickable = await page.$$('[onclick], [role="button"], [data-toggle]');
    
    log('页面链接数量: ' + allLinks.length);
    log('页面按钮数量: ' + allButtons.length);
    log('其他可点击元素: ' + allClickable.length);
    
    // 获取所有链接文本
    const linkTexts = [];
    for (const link of allLinks) {
      const text = await link.textContent();
      const href = await link.getAttribute('href');
      if (text && text.trim()) {
        linkTexts.push({ text: text.trim(), href: href });
      }
    }
    
    log('所有链接文本: ' + JSON.stringify(linkTexts, null, 2));
    
    // 获取所有按钮文本
    const buttonTexts = [];
    for (const btn of allButtons) {
      const text = await btn.textContent();
      if (text && text.trim()) {
        buttonTexts.push(text.trim());
      }
    }
    
    log('所有按钮文本: ' + JSON.stringify(buttonTexts, null, 2));
    
    // ========== 普通用户测试 ==========
    log('\n========== 普通用户真实点击测试 ==========');
    
    // 登出
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // 登录普通用户
    log('\n--- 普通用户登录 ---');
    await page.goto(BASE_URL + '/login.html', { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    
    const userUsernameInput = await page.$('input[name="username"], input[placeholder*="用户名"], input[placeholder*="请输入用户名"]');
    const userPasswordInput = await page.$('input[type="password"], input[placeholder*="密码"]');
    
    if (userUsernameInput) await userUsernameInput.fill('2426366814');
    if (userPasswordInput) await userPasswordInput.fill('ck123456@');
    await takeScreenshot(page, 'user_01_login_filled');
    
    const userLoginBtn = await page.$('button[type="submit"], button:has-text("登录")');
    if (userLoginBtn) await userLoginBtn.click();
    await sleep(3000);
    await takeScreenshot(page, 'user_02_after_login');
    log('普通用户登录完成');
    
    // 导航到 Dashboard
    await page.goto(BASE_URL + '/dashboard.html', { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    await takeScreenshot(page, 'user_03_dashboard');
    
    // 获取用户页面所有导航链接
    log('\n--- 获取用户页面所有导航链接 ---');
    const userLinks = await page.$$('a');
    const userLinkTexts = [];
    for (const link of userLinks) {
      const text = await link.textContent();
      const href = await link.getAttribute('href');
      if (text && text.trim()) {
        userLinkTexts.push({ text: text.trim(), href: href });
      }
    }
    
    log('用户页面所有链接: ' + JSON.stringify(userLinkTexts, null, 2));
    
    // 真实点击每个用户标签
    log('\n--- 真实点击用户标签测试 ---');
    
    const userTabs = [
      { name: '概览', selector: 'a:has-text("概览"), [href*="dashboard"]' },
      { name: '对话', selector: 'a:has-text("对话"), [href*="chat"]' },
      { name: '智能功能', selector: 'a:has-text("智能功能"), [href*="intelligence"]' },
      { name: '记忆复习', selector: 'a:has-text("记忆复习"), [href*="review"]' },
      { name: '知识库', selector: 'a:has-text("知识库"), [href*="knowledge"]' },
      { name: '数据可视化', selector: 'a:has-text("数据可视化"), [href*="visualization"]' },
      { name: '安全设置', selector: 'a:has-text("安全设置"), [href*="security"]' },
      { name: 'LLM路由', selector: 'a:has-text("LLM路由"), [href*="provider"]' },
      { name: '个人资料', selector: 'a:has-text("个人资料"), [href*="profile"]' }
    ];
    
    for (let i = 0; i < userTabs.length; i++) {
      const tab = userTabs[i];
      log('\n尝试点击用户标签: ' + tab.name);
      
      try {
        await takeScreenshot(page, 'user_before_click_' + tab.name);
        
        let tabElement = null;
        const selectors = tab.selector.split(', ');
        
        for (const selector of selectors) {
          tabElement = await page.$(selector);
          if (tabElement) {
            log('找到元素: ' + selector);
            break;
          }
        }
        
        if (tabElement) {
          await tabElement.scrollIntoViewIfNeeded();
          await sleep(500);
          await tabElement.click();
          log('已点击: ' + tab.name);
          await sleep(2000);
          await takeScreenshot(page, 'user_after_click_' + tab.name);
          
          results.user.tabs.push({
            name: tab.name,
            status: 'clicked',
            elementFound: true
          });
        } else {
          log('未找到用户标签元素: ' + tab.name);
          results.user.errors.push({
            tab: tab.name,
            error: '元素未找到'
          });
        }
      } catch (error) {
        log('点击用户标签 ' + tab.name + ' 时出错: ' + error.message);
        results.user.errors.push({
          tab: tab.name,
          error: error.message
        });
      }
    }
    
    log('\n========== 所有测试完成！ ==========');
    log('截图已保存到: ' + SCREENSHOT_DIR);
    
    await sleep(3000);
    await session.close();
    
    return {
      success: true,
      screenshotDir: SCREENSHOT_DIR,
      screenshots: fs.readdirSync(SCREENSHOT_DIR),
      results: results,
      adminLinks: linkTexts,
      adminButtons: buttonTexts,
      userLinks: userLinkTexts
    };
    
  } catch (error) {
    log('错误: ' + error.message);
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
      error: error.message,
      results: results
    };
  }
}

runRealClickTest().then(result => {
  console.log('\n========== 检测结果 ==========');
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
});
