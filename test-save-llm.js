const { chromium } = require('D:\\playwright-data\\lib\\node_modules\\playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    console.log('=== 测试保存 LLM 配置 ===\n');
    
    // 登录
    console.log('1. 登录...');
    await page.goto('https://memory.91wz.org/login', { waitUntil: 'domcontentloaded' });
    await page.fill('#username', '2426366814');
    await page.fill('#password', 'ck123456@');
    await page.click('#loginBtn');
    await page.waitForTimeout(3000);
    console.log('   登录成功\n');
    
    // 打开设置页面
    console.log('2. 打开设置页面...');
    await page.goto('https://memory.91wz.org/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    console.log('   页面加载完成\n');
    
    // 找到智谱AI GLM 并点击配置
    console.log('3. 查找智谱AI GLM 配置按钮...');
    const zhipuBtn = await page.evaluate(() => {
        const items = document.querySelectorAll('.provider-item');
        for (const item of items) {
            if (item.textContent.includes('智谱') || item.textContent.includes('GLM') || item.textContent.includes('zhipu')) {
                const btn = item.querySelector('.configure-provider-btn, button');
                if (btn) {
                    btn.click();
                    return true;
                }
            }
        }
        return false;
    });
    
    if (zhipuBtn) {
        console.log('   找到并点击了配置按钮\n');
        await page.waitForTimeout(1000);
        
        // 填写 API Key
        console.log('4. 填写 API Key...');
        const apiKeyInput = await page.$('#apiKeyInput');
        if (apiKeyInput) {
            await apiKeyInput.fill('test_api_key_for_testing_12345');
            console.log('   API Key 已填写\n');
            
            // 点击保存
            console.log('5. 点击保存按钮...');
            const saveBtn = await page.$('#saveApiKeyBtn');
            if (saveBtn) {
                await saveBtn.click();
                await page.waitForTimeout(3000);
                console.log('   保存按钮已点击\n');
                
                // 检查是否有提示
                const toast = await page.$('.toast');
                if (toast) {
                    const toastText = await toast.textContent();
                    console.log('   提示信息:', toastText);
                }
                
                // 截图
                await page.screenshot({ path: 'reports/screenshots/settings_save_test.png', fullPage: true });
                console.log('\n截图已保存');
            } else {
                console.log('   未找到保存按钮');
            }
        } else {
            console.log('   未找到 API Key 输入框');
        }
    } else {
        console.log('   未找到智谱AI GLM 配置按钮');
    }
    
    // 验证保存结果
    console.log('\n6. 验证保存结果...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    const zhipuStatus = await page.evaluate(() => {
        const items = document.querySelectorAll('.provider-item');
        for (const item of items) {
            if (item.textContent.includes('智谱') || item.textContent.includes('GLM')) {
                return {
                    text: item.textContent.trim().substring(0, 100),
                    hasKey: item.textContent.includes('已配置')
                };
            }
        }
        return null;
    });
    
    console.log('   智谱AI GLM 状态:', zhipuStatus?.hasKey ? '✅ 已配置' : '❌ 未配置');
    console.log('   内容:', zhipuStatus?.text);
    
    await browser.close();
    console.log('\n=== 测试完成 ===');
})();
