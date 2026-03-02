const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = {
    host: '134.185.111.252',
    port: 1022,
    username: 'root',
    password: 'Qwer1234@',
    readyTimeout: 20000
};

const files = [
    'admin.html',
    'dashboard.html', 
    'security.html',
    'review.html',
    'knowledge.html',
    'providers.html',
    'profile.html',
    'visualization.html',
    'intelligence.html'
];

const localDir = path.join(__dirname, 'web');
const remoteDir = '/root/777-ms/web';

const conn = new Client();

conn.on('ready', () => {
    console.log('SSH connected!');
    
    let uploadIndex = 0;
    
    const uploadNext = () => {
        if (uploadIndex >= files.length) {
            console.log('All files uploaded!');
            conn.end();
            return;
        }
        
        const file = files[uploadIndex];
        const localPath = path.join(localDir, file);
        const remotePath = `${remoteDir}/${file}`;
        
        console.log(`Uploading ${file}...`);
        
        conn.sftp((err, sftp) => {
            if (err) {
                console.error('SFTP error:', err);
                conn.end();
                return;
            }
            
            sftp.fastPut(localPath, remotePath, (err) => {
                if (err) {
                    console.error(`Failed to upload ${file}:`, err.message);
                } else {
                    console.log(`Uploaded ${file}`);
                }
                uploadIndex++;
                uploadNext();
            });
        });
    };
    
    uploadNext();
});

conn.on('error', (err) => {
    console.error('SSH connection error:', err.message);
});

console.log('Connecting to SSH...');
conn.connect(config);
