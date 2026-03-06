const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = {
    host: '134.185.111.25',
    port: 1022,
    username: 'root',
    password: 'C^74+ek@dN',
    readyTimeout: 30000
};

const conn = new Client();

conn.on('ready', () => {
    console.log('SSH connected!');
    
    conn.sftp((err, sftp) => {
        if (err) {
            console.error('SFTP error:', err);
            conn.end();
            return;
        }
        
        const localPath = path.join(__dirname, 'server.js');
        const remotePath = '/home/wwwroot/memory.91wz.org/server.js';
        
        console.log('Uploading server.js...');
        
        sftp.fastPut(localPath, remotePath, (err) => {
            if (err) {
                console.error('Failed to upload server.js:', err.message);
                conn.end();
                return;
            }
            
            console.log('server.js uploaded successfully!');
            
            console.log('Restarting PM2 service...');
            conn.exec('cd /home/wwwroot/memory.91wz.org && pm2 restart 777-ms', (err, stream) => {
                if (err) {
                    console.error('Failed to restart:', err.message);
                    conn.end();
                    return;
                }
                
                stream.on('close', () => {
                    console.log('Service restarted!');
                    conn.end();
                }).on('data', (data) => {
                    console.log(data.toString());
                });
            });
        });
    });
});

conn.on('error', (err) => {
    console.error('SSH connection error:', err.message);
});

console.log('Connecting to SSH...');
conn.connect(config);
