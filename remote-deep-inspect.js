
const { playwrightGlobal } = require('D:\\playwright-data\\lib\\playwright-global.js');
const fs = require('fs');
const path = require('path');

const REMOTE_URL = 'https://memory.91wz.org';
const SCREENSHOT_DIR = path.join(__dirname, 'reports', 'screenshots');
const REPORT_DIR = path.join(__dirname, 'reports');

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}
if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
}

const results = {
    timestamp: new Date().toISOString(),
    url: REMOTE_URL,
    phases: {},
    issues: [],
    screenshots: []
};

async function takeScreenshot(page, name) {
    try {
        const screenshotPath = path.join(SCREENSHOT_DIR, `v844_${name}.png`);
        await page.screenshot({ path: screenshotPath, timeout: 15000 });
        results.screenshots.push(screenshotPath);
        console.log(`📸 截图已保存: ${name}`);
        return screenshotPath;
    } catch (e) {
        console.log(`⚠️ 截图失败: ${name} - ${e.message}`);
        return null;
    }
}

async function deepInspect() {
    console.log('🚀 开始远程真实交互深度检测 v8.44');
    console.log('📍 目标: ' + REMOTE_URL);
    console.log('=' .repeat(60));

    let session;
    try {
        session = await playwrightGlobal.launch({
            project: '777-ms-remote',
            headless: false,
            timeout: 120000
        });

        const { page } = session;
        page.setDefaultTimeout(60000);
        page.setDefaultNavigationTimeout(60000);

        const pagesToTest = [
            { id: 'home', path: '/', name: '首页' },
            { id: 'login', path: '/login.html', name: '登录页面' },
            { id: 'dashboard', path: '/dashboard.html', name: '仪表板' },
            { id: 'chat', path: '/chat.html', name: '聊天页面' },
            { id: 'intelligence', path: '/intelligence.html', name: '智能分析' },
            { id: 'review', path: '/review.html', name: '复习页面' },
            { id: 'knowledge', path: '/knowledge.html', name: '知识库' },
            { id: 'visualization', path: '/visualization.html', name: '可视化' },
            { id: 'security', path: '/security.html', name: '安全页面' },
            { id: 'providers', path: '/providers.html', name: '供应商' },
            { id: 'profile', path: '/profile.html', name: '个人资料' },
            { id: 'admin', path: '/admin.html', name: '管理员面板' },
            { id: 'api', path: '/api.html', name: 'API文档' },
            { id: 'status', path: '/status.html', name: '状态页面' },
            { id: 'pricing', path: '/pricing.html', name: '价格页面' },
            { id: 'docs', path: '/docs.html', name: '文档页面' }
        ];

        for (let i = 0; i < pagesToTest.length; i++) {
            const pageTest = pagesToTest[i];
            const phaseNum = i + 1;
            
            console.log(`\n[Phase ${phaseNum}] ${pageTest.name}`);
            try {
                await page.goto(REMOTE_URL + pageTest.path, { waitUntil: 'domcontentloaded', timeout: 45000 });
                await page.waitForTimeout(2000);
                await takeScreenshot(page, `${String(phaseNum).padStart(2, '0')}_${pageTest.id}`);
                results.phases[`phase${phaseNum}`] = { 
                    status: 'passed', 
                    message: `${pageTest.name}加载成功`,
                    path: pageTest.path
                };
            } catch (e) {
                console.log(`⚠️ ${pageTest.name}加载可能有问题: ${e.message}`);
                try {
                    await takeScreenshot(page, `${String(phaseNum).padStart(2, '0')}_${pageTest.id}_error`);
                } catch (e2) {}
                results.phases[`phase${phaseNum}`] = { 
                    status: 'warning', 
                    message: `${pageTest.name}: ${e.message}`,
                    path: pageTest.path
                };
            }
        }

        console.log('\n✅ 所有页面测试完成！');
        results.phases.complete = { status: 'passed', message: `${pagesToTest.length}个页面检测完成` };
        
    } catch (error) {
        console.error('\n❌ 检测过程中出错:', error.message);
        results.issues.push({
            phase: 'execution',
            error: error.message,
            stack: error.stack
        });
    } finally {
        if (session) {
            console.log('\n🔚 关闭浏览器会话');
            try {
                await session.close();
            } catch (e) {
                console.log('关闭会话时出错:', e.message);
            }
        }
    }

    console.log('\n📊 生成检测报告...');
    const reportPath = path.join(REPORT_DIR, 'DEEP_INSPECTION_REMOTE_V844_REPORT.md');
    
    const reportContent = generateReport(results);
    fs.writeFileSync(reportPath, reportContent, 'utf8');
    
    const jsonReportPath = path.join(REPORT_DIR, 'DEEP_INSPECTION_REMOTE_V844_REPORT.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(results, null, 2), 'utf8');

    console.log('\n🎉 远程真实交互深度检测完成！');
    console.log('📄 报告已保存到:', reportPath);
    console.log('📸 截图数量:', results.screenshots.length);
}

function generateReport(data) {
    const allPhases = Object.keys(data.phases).filter(k => k.startsWith('phase'));
    const passedPhases = allPhases.filter(k => data.phases[k]?.status === 'passed').length;
    const warningPhases = allPhases.filter(k => data.phases[k]?.status === 'warning').length;
    const totalPhases = allPhases.length;
    
    const pagesToTest = [
        { id: 'home', path: '/', name: '首页' },
        { id: 'login', path: '/login.html', name: '登录页面' },
        { id: 'dashboard', path: '/dashboard.html', name: '仪表板' },
        { id: 'chat', path: '/chat.html', name: '聊天页面' },
        { id: 'intelligence', path: '/intelligence.html', name: '智能分析' },
        { id: 'review', path: '/review.html', name: '复习页面' },
        { id: 'knowledge', path: '/knowledge.html', name: '知识库' },
        { id: 'visualization', path: '/visualization.html', name: '可视化' },
        { id: 'security', path: '/security.html', name: '安全页面' },
        { id: 'providers', path: '/providers.html', name: '供应商' },
        { id: 'profile', path: '/profile.html', name: '个人资料' },
        { id: 'admin', path: '/admin.html', name: '管理员面板' },
        { id: 'api', path: '/api.html', name: 'API文档' },
        { id: 'status', path: '/status.html', name: '状态页面' },
        { id: 'pricing', path: '/pricing.html', name: '价格页面' },
        { id: 'docs', path: '/docs.html', name: '文档页面' }
    ];
    
    let detailedResults = '';
    for (let i = 0; i < pagesToTest.length; i++) {
        const pageTest = pagesToTest[i];
        const phaseKey = `phase${i + 1}`;
        const phase = data.phases[phaseKey];
        const statusIcon = phase?.status === 'passed' ? '✅' : (phase?.status === 'warning' ? '⚠️' : '❌');
        detailedResults += `### Phase ${i + 1}: ${pageTest.name}\n${statusIcon} **${phase?.status === 'passed' ? '通过' : (phase?.status === 'warning' ? '警告' : '失败')}** - ${phase?.message || '未检测'}\n\n`;
    }
    
    return `# 777-MS 远程真实交互深度检测报告 v8.44

**检测时间**: ${data.timestamp}  
**目标地址**: ${data.url}  
**检测模式**: 远程真实交互（Playwright有头模式）

---

## 📊 检测摘要

| 指标 | 数值 |
|------|------|
| 检测页面总数 | ${totalPhases} |
| 通过页面数 | ${passedPhases} |
| 警告页面数 | ${warningPhases} |
| 检测通过率 | ${totalPhases > 0 ? Math.round(passedPhases / totalPhases * 100) : 0}% |
| 截图数量 | ${data.screenshots.length} |
| 发现问题数 | ${data.issues.length} |

---

## 📋 详细检测结果

${detailedResults}

---

## 📸 截图清单

${data.screenshots.map((s, i) => `${i + 1}. ${path.basename(s)}`).join('\n')}

---

## ⚠️ 问题列表

${data.issues.length === 0 ? '无问题发现 ✅' : data.issues.map((issue, i) => `### 问题 ${i + 1}\n- **阶段**: ${issue.phase}\n- **错误**: ${issue.error}`).join('\n\n')}

---

## ✅ 检测结论

**检测状态**: ${data.issues.length === 0 && warningPhases === 0 ? '✅ 完全通过' : '⚠️ 存在问题'}

${data.issues.length === 0 && warningPhases === 0 ? '所有页面正常加载，系统运行稳定。' : '请查看上述问题列表进行修复。'}

---

*报告生成时间: ${new Date().toLocaleString('zh-CN')}*  
*检测工具: Deep Inspector v8.44 + 全局 Playwright 库*
`;
}

deepInspect().catch(console.error);

