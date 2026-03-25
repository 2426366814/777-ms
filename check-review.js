const { chromium } = require('D:\\playwright-data\\lib\\node_modules\\playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // 设置默认超时
    page.setDefaultTimeout(60000);
    
    console.log('=== 复习功能检查 ===\n');
    
    // 登录
    console.log('1. 登录中...');
    await page.goto('https://memory.91wz.org/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.fill('#username', '2426366814');
    await page.fill('#password', 'ck123456@');
    await page.click('#loginBtn');
    await page.waitForTimeout(5000);
    console.log('   登录成功\n');
    
    // 检查复习页面
    console.log('2. 检查复习页面...');
    await page.goto('https://memory.91wz.org/review', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    
    // 检查 LLM 选择器
    const llmSelect = await page.$('#llmProvider');
    if (llmSelect) {
        const options = await llmSelect.$$('option');
        console.log(`   LLM 选择器: ✅ 找到 (${options.length} 个选项)`);
        
        const optionTexts = await Promise.all(options.map(o => o.textContent()));
        console.log('   选项列表:', optionTexts.slice(0, 5).join(', ') + '...');
        
        // 选择 zhipu
        await page.selectOption('#llmProvider', 'zhipu');
        console.log('   已选择: 智谱AI GLM\n');
    } else {
        console.log('   LLM 选择器: ❌ 未找到!\n');
    }
    
    // 检查复习列表
    console.log('3. 检查复习列表...');
    const reviewList = await page.$('#reviewList');
    if (reviewList) {
        const hasItems = await reviewList.$('.start-review-btn');
        if (hasItems) {
            console.log('   复习列表: ✅ 有待复习项目');
            
            // 点击第一个复习按钮测试
            console.log('\n4. 测试复习功能...');
            await hasItems.click();
            await page.waitForTimeout(10000);
            
            const modalContent = await page.$('#modalContent');
            const questions = await page.$('#modalQuestions');
            
            if (modalContent && questions) {
                const contentText = await modalContent.textContent();
                const questionsText = await questions.textContent();
                console.log('   模态框内容:', contentText?.trim().substring(0, 50));
                console.log('   问题内容:', questionsText?.trim().substring(0, 100));
            }
        } else {
            console.log('   复习列表: ⚠️ 空 (没有待复习的记忆)');
        }
    }
    
    // 截图
    await page.screenshot({ path: 'reports/screenshots/review_check_final.png', fullPage: true });
    console.log('\n截图已保存: reports/screenshots/review_check_final.png');
    
    await browser.close();
    console.log('\n=== 检查完成 ===');
})();
