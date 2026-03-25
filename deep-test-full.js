const { playwrightGlobal } = require('D:\\playwright-data\\lib\\playwright-global.js');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, 'reports', 'screenshots', 'deep_test_v848');

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

async function runDeepTest() {
  log('========== 777-MS 远程深度交互完整测试 v8.48 ==========');
  
  let session;
  const results = {
    user: { tabs: [], crud: [], errors: [] },
    admin: { tabs: [], crud: [], errors: [] }
  };
  
  try {
    log('正在启动 Playwright 全局库...');
    session = await playwrightGlobal.launch({
      project: '777-ms-deep-test',
      headless: false,
    });
    
    const { page } = session;
    log('浏览器已启动');
    
    const BASE_URL = 'https://memory.91wz.org';
    
    // ========== 普通用户测试 ==========
    log('\n========== 普通用户测试 ==========');
    
    log('\n--- Phase 1: 普通用户登录 ---');
    await page.goto(BASE_URL + '/login.html', { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    await takeScreenshot(page, 'user_01_login_page');
    
    await page.waitForSelector('input', { timeout: 10000 });
    const usernameInput = await page.$('input[name="username"], input[placeholder*="用户名"], input[placeholder*="请输入用户名"]');
    const passwordInput = await page.$('input[type="password"], input[placeholder*="密码"]');
    
    if (usernameInput) await usernameInput.fill('2426366814');
    if (passwordInput) await passwordInput.fill('ck123456@');
    await takeScreenshot(page, 'user_02_login_filled');
    
    const loginBtn = await page.$('button[type="submit"], button:has-text("登录")');
    if (loginBtn) await loginBtn.click();
    await sleep(3000);
    await takeScreenshot(page, 'user_03_after_login');
    log('普通用户登录完成');
    
    // ========== 普通用户标签点击测试 ==========
    log('\n--- Phase 2: 普通用户标签点击测试 ---');
    
    const userTabs = [
      { name: '概览', url: '/dashboard.html' },
      { name: '对话', url: '/chat.html' },
      { name: '智能功能', url: '/intelligence.html' },
      { name: '记忆复习', url: '/review.html' },
      { name: '知识库', url: '/knowledge.html' },
      { name: '数据可视化', url: '/visualization.html' },
      { name: '安全设置', url: '/security.html' },
      { name: 'LLM路由', url: '/providers.html' },
      { name: '个人资料', url: '/profile.html' }
    ];
    
    for (let i = 0; i < userTabs.length; i++) {
      const tab = userTabs[i];
      log('点击标签: ' + tab.name);
      try {
        await page.goto(BASE_URL + tab.url, { waitUntil: 'networkidle', timeout: 30000 });
        await sleep(2000);
        await takeScreenshot(page, 'user_tab_' + (i + 4).toString().padStart(2, '0') + '_' + tab.name);
        results.user.tabs.push({ name: tab.name, url: tab.url, status: 'success' });
        log('标签 ' + tab.name + ' 访问成功');
      } catch (error) {
        log('标签 ' + tab.name + ' 访问失败: ' + error.message);
        results.user.errors.push({ tab: tab.name, error: error.message });
      }
    }
    
    // ========== 普通用户 CRUD 测试 ==========
    log('\n--- Phase 3: 普通用户 CRUD 功能测试 ---');
    
    // 测试记忆管理页面
    log('测试记忆管理 CRUD...');
    await page.goto(BASE_URL + '/dashboard.html', { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    
    // 查找添加记忆按钮
    const addMemoryBtn = await page.$('button:has-text("添加记忆"), button:has-text("新增")');
    if (addMemoryBtn) {
      log('找到添加记忆按钮，点击测试...');
      await addMemoryBtn.click();
      await sleep(1000);
      await takeScreenshot(page, 'user_crud_01_add_memory_modal');
      results.user.crud.push({ action: 'create', target: 'memory', status: 'button_found' });
    } else {
      log('未找到添加记忆按钮');
      results.user.crud.push({ action: 'create', target: 'memory', status: 'button_not_found' });
    }
    
    // 测试知识库页面
    log('测试知识库 CRUD...');
    await page.goto(BASE_URL + '/knowledge.html', { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    await takeScreenshot(page, 'user_crud_02_knowledge_page');
    
    const addKnowledgeBtn = await page.$('button:has-text("添加知识"), button:has-text("新增")');
    if (addKnowledgeBtn) {
      log('找到添加知识按钮');
      results.user.crud.push({ action: 'create', target: 'knowledge', status: 'button_found' });
    } else {
      results.user.crud.push({ action: 'create', target: 'knowledge', status: 'button_not_found' });
    }
    
    // 测试个人资料页面
    log('测试个人资料 CRUD...');
    await page.goto(BASE_URL + '/profile.html', { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    await takeScreenshot(page, 'user_crud_03_profile_page');
    
    const saveProfileBtn = await page.$('button:has-text("保存"), button:has-text("修改")');
    if (saveProfileBtn) {
      log('找到保存按钮');
      results.user.crud.push({ action: 'update', target: 'profile', status: 'button_found' });
    } else {
      results.user.crud.push({ action: 'update', target: 'profile', status: 'button_not_found' });
    }
    
    // ========== 普通用户登出 ==========
    log('\n--- 普通用户登出 ---');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(BASE_URL + '/login.html', { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    await takeScreenshot(page, 'user_99_logout');
    log('普通用户登出完成');
    
    // ========== 管理员用户测试 ==========
    log('\n========== 管理员用户测试 ==========');
    
    log('\n--- Phase 4: 管理员用户登录 ---');
    await page.waitForSelector('input', { timeout: 10000 });
    const adminUsernameInput = await page.$('input[name="username"], input[placeholder*="用户名"], input[placeholder*="请输入用户名"]');
    const adminPasswordInput = await page.$('input[type="password"], input[placeholder*="密码"]');
    
    if (adminUsernameInput) await adminUsernameInput.fill('cccp');
    if (adminPasswordInput) await adminPasswordInput.fill('ck123456@');
    await takeScreenshot(page, 'admin_01_login_filled');
    
    const adminLoginBtn = await page.$('button[type="submit"], button:has-text("登录")');
    if (adminLoginBtn) await adminLoginBtn.click();
    await sleep(3000);
    await takeScreenshot(page, 'admin_02_after_login');
    log('管理员用户登录完成');
    
    // ========== 管理员用户标签点击测试 ==========
    log('\n--- Phase 5: 管理员用户标签点击测试 ---');
    
    const adminTabs = [
      { name: '控制台', url: '/admin.html' },
      { name: '系统健康', url: '/admin.html#health' },
      { name: '日志审计', url: '/admin.html#logs' },
      { name: '用户管理', url: '/admin.html#users' },
      { name: '权限管理', url: '/admin.html#permissions' },
      { name: '提供商管理', url: '/admin.html#providers' },
      { name: 'API Key 池', url: '/admin.html#apikeys' },
      { name: '自动任务', url: '/admin.html#tasks' },
      { name: '备份管理', url: '/admin.html#backup' },
      { name: '公告管理', url: '/admin.html#announcements' }
    ];
    
    for (let i = 0; i < adminTabs.length; i++) {
      const tab = adminTabs[i];
      log('点击管理员标签: ' + tab.name);
      try {
        await page.goto(BASE_URL + tab.url, { waitUntil: 'networkidle', timeout: 30000 });
        await sleep(2000);
        await takeScreenshot(page, 'admin_tab_' + (i + 3).toString().padStart(2, '0') + '_' + tab.name);
        results.admin.tabs.push({ name: tab.name, url: tab.url, status: 'success' });
        log('管理员标签 ' + tab.name + ' 访问成功');
      } catch (error) {
        log('管理员标签 ' + tab.name + ' 访问失败: ' + error.message);
        results.admin.errors.push({ tab: tab.name, error: error.message });
      }
    }
    
    // ========== 管理员用户 CRUD 测试 ==========
    log('\n--- Phase 6: 管理员用户 CRUD 功能测试 ---');
    
    // 测试用户管理
    log('测试用户管理 CRUD...');
    await page.goto(BASE_URL + '/admin.html', { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    await takeScreenshot(page, 'admin_crud_01_user_management');
    
    const addUserBtn = await page.$('button:has-text("添加用户"), button:has-text("新增用户")');
    if (addUserBtn) {
      log('找到添加用户按钮');
      results.admin.crud.push({ action: 'create', target: 'user', status: 'button_found' });
    } else {
      results.admin.crud.push({ action: 'create', target: 'user', status: 'button_not_found' });
    }
    
    // 测试 API Key 管理
    log('测试 API Key 管理...');
    const manageApiKeysBtn = await page.$('button:has-text("API Key"), button:has-text("管理密钥")');
    if (manageApiKeysBtn) {
      log('找到 API Key 管理按钮');
      results.admin.crud.push({ action: 'manage', target: 'api_keys', status: 'button_found' });
    } else {
      results.admin.crud.push({ action: 'manage', target: 'api_keys', status: 'button_not_found' });
    }
    
    // 测试备份管理
    log('测试备份管理...');
    const createBackupBtn = await page.$('button:has-text("创建备份"), button:has-text("备份")');
    if (createBackupBtn) {
      log('找到创建备份按钮');
      results.admin.crud.push({ action: 'create', target: 'backup', status: 'button_found' });
    } else {
      results.admin.crud.push({ action: 'create', target: 'backup', status: 'button_not_found' });
    }
    
    log('\n========== 所有测试完成！ ==========');
    log('截图已保存到: ' + SCREENSHOT_DIR);
    
    await sleep(3000);
    await session.close();
    
    return {
      success: true,
      screenshotDir: SCREENSHOT_DIR,
      screenshots: fs.readdirSync(SCREENSHOT_DIR),
      results: results
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

runDeepTest().then(result => {
  console.log('\n========== 检测结果 ==========');
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
});
