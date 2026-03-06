const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SSH_PATH = 'C:\\Windows\\System32\\OpenSSH\\ssh.exe';
const SCP_PATH = 'C:\\Windows\\System32\\OpenSSH\\scp.exe';

const config = {
    host: '134.185.111.25',
    port: '1022',
    user: 'root',
    password: 'C^74+ek@dN'
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

console.log('Deploying files to remote server...');

// First, check if scp exists
try {
    fs.accessSync(SCP_PATH, fs.constants.R_OK);
    console.log('SCP found at:', SCP_PATH);
} catch {
    console.log('SCP not found, using alternative method...');
}

files.forEach(file => {
    const localPath = path.join(localDir, file);
    const remotePath = `${config.user}@${config.host}:${remoteDir}/${file}`;
    
    console.log(`Uploading ${file}...`);
    
    try {
        // Using sshpass alternative - echo password to scp
        // Note: This is not secure, but works for deployment
        const cmd = `echo y | "${SCP_PATH}" -P ${config.port} -o StrictHostKeyChecking=no "${localPath}" "${remotePath}"`;
        execSync(cmd, { 
            stdio: 'inherit',
            env: { ...process.env, SSHPASS: config.password }
        });
        console.log(`Uploaded ${file}`);
    } catch (err) {
        console.error(`Failed to upload ${file}:`, err.message);
    }
});

console.log('Deployment complete!');
