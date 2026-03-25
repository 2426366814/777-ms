const { chromium } = require('D:\\playwright-data\\lib\\node_modules\\playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // 登录
    await page.goto('https://memory.91wz.org/login', { waitUntil: 'networkidle' });
    await page.fill('#username', '2426366814');
    await page.fill('#password', 'ck123456@');
    await page.click('#loginBtn');
    await page.waitForTimeout(3000);
    
    // 检查复习页面
    await page.goto('https://memory.91wz.org/review', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // 选择 zhipu
    await page.selectOption('#llmProvider', 'zhipu');
    
    // 等待复习列表加载
    await page.waitForTimeout(2000);
    
    // 点击第一个开始复习按钮
    const reviewBtn = await page.$('.start-review-btn');
    if (reviewBtn) {
        await reviewBtn.click();
        await page.waitForTimeout(8000);
        
        // 检查复习模态框内容
        const modalContent = await page.evaluate(() => {
            const content = document.getElementById('modalContent');
            const questions = document.getElementById('modalQuestions');
            return {
                content: content?.textContent?.trim().substring(0, 200),
                questions: questions?.textContent?.trim().substring(0, 300),
                qualityButtonsVisible: document.getElementById('qualityButtons')?.style.display !== 'none'
            };
        });
        
        console.log('Modal Content:', modalContent.content);
        console.log('Questions:', modalContent.questions);
        console.log('Quality Buttons Visible:', modalContent.qualityButtonsVisible);
        
        // 截图
        await page.screenshot({ path: 'reports/screenshots/review_test_zhipu.png', fullPage: true });
    } else {
        console.log('No review items found');
        
        // 检查页面内容
        const pageContent = await page.evaluate(() => {
            return document.getElementById('reviewList')?.textContent?.trim().substring(0, 200);
        });
        console.log('Review List Content:', pageContent);
    }
    
    await browser.close();
})();
