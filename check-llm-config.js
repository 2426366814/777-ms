const { chromium } = require('D:\\playwright-data\\lib\\node_modules\\playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    console.log('=== 检查用户 LLM 配置状态 ===\n');
    
    // 登录
    await page.goto('https://memory.91wz.org/login', { waitUntil: 'domcontentloaded' });
    await page.fill('#username', '2426366814');
    await page.fill('#password', 'ck123456@');
    await page.click('#loginBtn');
    await page.waitForTimeout(3000);
    
    // 打开设置页面
    await page.goto('https://memory.91wz.org/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // 检查 LLM 配置区域
    const llmSection = await page.$('#llmConfigSection, .llm-config-section, #providerList');
    if (llmSection) {
        const providers = await page.evaluate(() => {
            const items = document.querySelectorAll('.provider-item, .llm-provider-item');
            return Array.from(items).map(item => {
                const name = item.querySelector('.provider-name, .name')?.textContent?.trim();
                const status = item.querySelector('.provider-status, .status')?.textContent?.trim();
                const hasKey = item.textContent.includes('已配置') || item.textContent.includes('configured');
                return { name, status, hasKey };
            });
        });
        
        console.log('LLM Providers:');
        providers.forEach(p => {
            console.log(`  - ${p.name}: ${p.hasKey ? '✅ 已配置' : '❌ 未配置'}`);
        });
    } else {
        console.log('未找到 LLM 配置区域');
    }
    
    // 截图
    await page.screenshot({ path: 'reports/screenshots/settings_llm_check.png', fullPage: true });
    console.log('\n截图已保存: reports/screenshots/settings_llm_check.png');
    
    await browser.close();
})();
