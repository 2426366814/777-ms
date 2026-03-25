/**
 * JSON.parse 错误处理修复脚本
 * 为所有缺少 try-catch 的 JSON.parse 调用添加错误处理
 */

const fs = require('fs');
const path = require('path');

const fixes = [
    {
        file: 'src/services/AutoManager.js',
        line: 552,
        old: `JSON.parse(task.content)`,
        new: `(() => { try { return JSON.parse(task.content); } catch (e) { logger.warn('Invalid JSON in extraction task:', e.message); return []; } })()`
    },
    {
        file: 'src/routes/templates.js',
        lines: [87, 134, 271],
        pattern: /JSON\.parse\(t\.template_data \|\| '{}'\)/g,
        replacement: `(() => { try { return JSON.parse(t.template_data || '{}'); } catch (e) { return {}; } })()`
    },
    {
        file: 'src/routes/settings.js',
        line: 51,
        old: `JSON.parse(settings.custom_settings || '{}')`,
        new: `(() => { try { return JSON.parse(settings.custom_settings || '{}'); } catch (e) { return {}; } })()`
    }
];

function applyFixes() {
    console.log('=== 开始修复 JSON.parse 错误处理 ===\n');
    
    for (const fix of fixes) {
        const filePath = path.join(__dirname, fix.file);
        
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️ 文件不存在: ${fix.file}`);
            continue;
        }
        
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        if (fix.old) {
            if (content.includes(fix.old)) {
                content = content.replace(fix.old, fix.new);
                modified = true;
                console.log(`✅ 修复: ${fix.file} - 替换特定代码`);
            }
        } else if (fix.pattern) {
            const matches = content.match(fix.pattern);
            if (matches) {
                content = content.replace(fix.pattern, fix.replacement);
                modified = true;
                console.log(`✅ 修复: ${fix.file} - 替换 ${matches.length} 处匹配`);
            }
        }
        
        if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`   已保存: ${filePath}`);
        } else {
            console.log(`⏭️ 跳过: ${fix.file} - 无需修改`);
        }
    }
    
    console.log('\n=== 修复完成 ===');
}

applyFixes();
