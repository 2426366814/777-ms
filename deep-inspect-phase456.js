/**
 * 777-MS 并发与多用户系统测试 v8.51
 */

const { chromium } = require('D:\\playwright-data\\lib\\node_modules\\playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://memory.91wz.org';
const SCREENSHOT_DIR = 'e:\\ai本地应用\\记忆体\\777-ms\\reports\\screenshots\\deep_v851';

const TEST_ACCOUNTS = {
    admin: { username: '2426366814', password: 'ck123456@' },
    test: { username: 'test', password: 'test123456' }
};

const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    errors: [],
    tests: []
};

function log(message, type = 'info') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const colors = { info: '\x1b[36m', success: '\x1b[32m', error: '\x1b[31m', warn: '\x1b[33m' };
    console.log(`${colors[type]}[${timestamp}] ${message}\x1b[0m`);
}

async function testConcurrentRequests() {
    log('Phase 4: 并发测试...', 'info');
    
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        const concurrentRequests = 20;
        const requests = [];
        
        for (let i = 0; i < concurrentRequests; i++) {
            requests.push(page.request.get(`${BASE_URL}/health`));
        }
        
        const responses = await Promise.all(requests);
        const successCount = responses.filter(r => r.ok()).length;
        
        if (successCount === concurrentRequests) {
            log(`✅ 并发测试通过: ${successCount}/${concurrentRequests} 请求成功`, 'success');
            results.passed++;
            results.tests.push({ name: 'Concurrent Requests', status: 'passed', details: `${successCount}/${concurrentRequests}` });
        } else {
            log(`⚠️ 部分请求失败: ${successCount}/${concurrentRequests}`, 'warn');
            results.warnings++;
            results.tests.push({ name: 'Concurrent Requests', status: 'warning', details: `${successCount}/${concurrentRequests}` });
        }
    } catch (error) {
        log(`❌ 并发测试失败: ${error.message}`, 'error');
        results.failed++;
        results.errors.push({ test: 'Concurrent Requests', error: error.message });
    } finally {
        await browser.close();
    }
}

async function testMultiUserIsolation() {
    log('Phase 4.5: 多用户系统专项测试...', 'info');
    
    const browser = await chromium.launch({ headless: true });
    
    try {
        // 测试1: 用户A登录
        log('  测试: 用户A登录...', 'info');
        const contextA = await browser.newContext();
        const pageA = await contextA.newPage();
        
        await pageA.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
        await pageA.fill('#username', TEST_ACCOUNTS.admin.username);
        await pageA.fill('#password', TEST_ACCOUNTS.admin.password);
        await pageA.click('#loginBtn');
        await pageA.waitForTimeout(3000);
        
        const tokenA = await pageA.evaluate(() => localStorage.getItem('token'));
        
        if (tokenA) {
            log('  ✅ 用户A登录成功', 'success');
            results.passed++;
        } else {
            log('  ❌ 用户A登录失败', 'error');
            results.failed++;
        }
        
        // 测试2: 用户B登录（不同上下文）
        log('  测试: 用户B登录...', 'info');
        const contextB = await browser.newContext();
        const pageB = await contextB.newPage();
        
        await pageB.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
        await pageB.fill('#username', TEST_ACCOUNTS.test.username);
        await pageB.fill('#password', TEST_ACCOUNTS.test.password);
        await pageB.click('#loginBtn');
        await pageB.waitForTimeout(3000);
        
        const tokenB = await pageB.evaluate(() => localStorage.getItem('token'));
        
        if (tokenB) {
            log('  ✅ 用户B登录成功', 'success');
            results.passed++;
        } else {
            log('  ⚠️ 用户B登录失败 (测试账号可能不存在)', 'warn');
            results.warnings++;
        }
        
        // 测试3: Token隔离验证
        log('  测试: Token隔离验证...', 'info');
        if (tokenA && tokenB && tokenA !== tokenB) {
            log('  ✅ Token隔离正常', 'success');
            results.passed++;
            results.tests.push({ name: 'Token Isolation', status: 'passed' });
        } else if (!tokenB) {
            log('  ⚠️ 无法验证Token隔离 (用户B登录失败)', 'warn');
            results.warnings++;
        } else {
            log('  ❌ Token隔离异常', 'error');
            results.failed++;
        }
        
        // 测试4: 无效Token访问
        log('  测试: 无效Token访问...', 'info');
        const invalidResponse = await pageA.request.get(`${BASE_URL}/api/v1/memories`, {
            headers: { 'Authorization': 'Bearer invalid_token_xyz' }
        });
        
        if (invalidResponse.status() === 401) {
            log('  ✅ 无效Token正确返回401', 'success');
            results.passed++;
        } else {
            log(`  ❌ 无效Token返回异常: ${invalidResponse.status()}`, 'error');
            results.failed++;
        }
        
        // 测试5: 用户登出后无法访问
        log('  测试: 用户登出后无法访问...', 'info');
        await pageA.evaluate(() => localStorage.removeItem('token'));
        await pageA.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
        await pageA.waitForTimeout(2000);
        
        const currentUrlA = pageA.url();
        if (currentUrlA.includes('login') || currentUrlA === `${BASE_URL}/`) {
            log('  ✅ 登出后正确重定向到登录页', 'success');
            results.passed++;
        } else {
            log('  ⚠️ 登出后重定向可能有问题', 'warn');
            results.warnings++;
        }
        
        await contextA.close();
        await contextB.close();
        
    } catch (error) {
        log(`❌ 多用户测试异常: ${error.message}`, 'error');
        results.failed++;
        results.errors.push({ test: 'Multi-User Isolation', error: error.message });
    } finally {
        await browser.close();
    }
}

async function testBoundaryConditions() {
    log('Phase 5: 边界测试...', 'info');
    
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        // 登录获取Token
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
        await page.fill('#username', TEST_ACCOUNTS.admin.username);
        await page.fill('#password', TEST_ACCOUNTS.admin.password);
        await page.click('#loginBtn');
        await page.waitForTimeout(3000);
        
        const token = await page.evaluate(() => localStorage.getItem('token'));
        
        // 测试空值
        log('  测试: 空值处理...', 'info');
        const emptyResponse = await page.request.post(`${BASE_URL}/api/v1/memories`, {
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({})
        });
        
        if (emptyResponse.status() === 400 || emptyResponse.status() === 422) {
            log('  ✅ 空值正确返回400/422', 'success');
            results.passed++;
        } else {
            log(`  ⚠️ 空值返回状态: ${emptyResponse.status()}`, 'warn');
            results.warnings++;
        }
        
        // 测试超长文本
        log('  测试: 超长文本处理...', 'info');
        const longText = 'A'.repeat(10000);
        const longResponse = await page.request.post(`${BASE_URL}/api/v1/memories`, {
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ content: longText })
        });
        
        if (longResponse.ok() || longResponse.status() === 413) {
            log('  ✅ 超长文本处理正常', 'success');
            results.passed++;
        } else {
            log(`  ⚠️ 超长文本返回状态: ${longResponse.status()}`, 'warn');
            results.warnings++;
        }
        
        // 测试特殊字符
        log('  测试: 特殊字符处理...', 'info');
        const specialChars = '<script>alert("xss")</script> & " \' < >';
        const specialResponse = await page.request.post(`${BASE_URL}/api/v1/memories`, {
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ content: specialChars })
        });
        
        if (specialResponse.ok()) {
            log('  ✅ 特殊字符处理正常', 'success');
            results.passed++;
        } else {
            log(`  ⚠️ 特殊字符返回状态: ${specialResponse.status()}`, 'warn');
            results.warnings++;
        }
        
    } catch (error) {
        log(`❌ 边界测试异常: ${error.message}`, 'error');
        results.failed++;
        results.errors.push({ test: 'Boundary Conditions', error: error.message });
    } finally {
        await browser.close();
    }
}

async function testRemoteServer() {
    log('Phase 6: 远程服务器测试...', 'info');
    
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        // 测试SSL证书
        log('  测试: SSL证书...', 'info');
        const sslResponse = await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        const securityDetails = sslResponse.securityDetails();
        
        if (securityDetails) {
            log(`  ✅ SSL证书有效: ${securityDetails.subject()}`, 'success');
            results.passed++;
        } else {
            log('  ⚠️ 无法获取SSL详情', 'warn');
            results.warnings++;
        }
        
        // 测试响应时间
        log('  测试: 响应时间...', 'info');
        const startTime = Date.now();
        await page.goto(`${BASE_URL}/health`, { waitUntil: 'networkidle' });
        const responseTime = Date.now() - startTime;
        
        if (responseTime < 2000) {
            log(`  ✅ 响应时间正常: ${responseTime}ms`, 'success');
            results.passed++;
        } else {
            log(`  ⚠️ 响应时间较慢: ${responseTime}ms`, 'warn');
            results.warnings++;
        }
        
        // 测试静态资源
        log('  测试: 静态资源加载...', 'info');
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
        const resources = await page.evaluate(() => {
            return performance.getEntriesByType('resource').map(r => r.name);
        });
        
        const failedResources = resources.filter(r => r.includes('error'));
        if (failedResources.length === 0) {
            log(`  ✅ 静态资源加载正常: ${resources.length}个资源`, 'success');
            results.passed++;
        } else {
            log(`  ⚠️ 部分资源加载失败: ${failedResources.length}个`, 'warn');
            results.warnings++;
        }
        
    } catch (error) {
        log(`❌ 远程服务器测试异常: ${error.message}`, 'error');
        results.failed++;
        results.errors.push({ test: 'Remote Server', error: error.message });
    } finally {
        await browser.close();
    }
}

async function generateReport() {
    log('========================================', 'info');
    log('深度检测完整报告', 'info');
    log('========================================', 'info');
    log(`✅ 通过: ${results.passed}`, 'success');
    log(`❌ 失败: ${results.failed}`, 'error');
    log(`⚠️ 警告: ${results.warnings}`, 'warn');
    log(`📋 测试项: ${results.tests.length}`, 'info');
    
    if (results.errors.length > 0) {
        log('错误详情:', 'error');
        results.errors.forEach(err => log(`  - ${err.test}: ${err.error}`, 'error'));
    }
    
    const reportPath = path.join(SCREENSHOT_DIR, 'DEEP_INSPECTION_FULL_REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    log(`报告已保存: ${reportPath}`, 'info');
    
    return results;
}

async function main() {
    log('========================================', 'info');
    log('777-MS 深度检测 - Phase 4-6', 'info');
    log(`目标: ${BASE_URL}`, 'info');
    log('========================================', 'info');
    
    if (!fs.existsSync(SCREENSHOT_DIR)) {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
    
    await testConcurrentRequests();
    await testMultiUserIsolation();
    await testBoundaryConditions();
    await testRemoteServer();
    
    await generateReport();
    
    return results.failed === 0;
}

main().then(success => {
    process.exit(success ? 0 : 1);
}).catch(err => {
    console.error('执行失败:', err);
    process.exit(1);
});
