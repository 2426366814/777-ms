const { Client } = require('ssh2');

const config = {
    host: '134.185.111.25',
    port: 1022,
    username: 'root',
    password: 'C^74+ek@dN',
    readyTimeout: 30000
};

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ SSH连接成功!\n');
    
    const commands = [
        'echo "=== 系统信息 ===" && uname -a',
        'echo "\n=== CPU信息 ===" && cat /proc/cpuinfo | grep "model name" | head -1',
        'echo "\n=== 内存状态 ===" && free -h',
        'echo "\n=== 磁盘状态 ===" && df -h /',
        'echo "\n=== PM2状态 ===" && pm2 status',
        'echo "\n=== Node.js版本 ===" && node -v',
        'echo "\n=== NPM版本 ===" && npm -v',
        'echo "\n=== 项目目录 ===" && cd /home/wwwroot/memory.91wz.org && ls -la',
        'echo "\n=== Git状态 ===" && cd /home/wwwroot/memory.91wz.org && git status',
        'echo "\n=== 最近日志 ===" && pm2 logs 777-ms --lines 20 --nostream'
    ];
    
    conn.exec(commands.join(' && '), (err, stream) => {
        if (err) {
            console.error('执行命令失败:', err);
            conn.end();
            return;
        }
        
        stream.on('close', () => {
            console.log('\n✅ 远程环境检查完成!');
            conn.end();
        }).on('data', (data) => {
            console.log(data.toString());
        }).stderr.on('data', (data) => {
            console.error('STDERR:', data.toString());
        });
    });
});

conn.on('error', (err) => {
    console.error('❌ SSH连接失败:', err.message);
});

console.log('🔌 正在连接远程服务器...');
conn.connect(config);
