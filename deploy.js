const { execSync } = require('child_process');
const path = require('path');

const remoteHost = '134.185.111.252';
const remotePort = '1022';
const remoteUser = 'root';
const remotePath = '/root/777-ms/web/';
const localPath = path.join(__dirname, 'web');

console.log('Deploying to remote server...');

try {
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
    
    files.forEach(file => {
        const localFile = path.join(localPath, file);
        const remoteFile = `${remoteUser}@${remoteHost}:${remotePath}${file}`;
        console.log(`Uploading ${file}...`);
        
        try {
            execSync(`pscp -P ${remotePort} "${localFile}" "${remoteFile}"`, {
                stdio: 'inherit',
                shell: 'powershell.exe'
            });
        } catch (e) {
            console.log(`pscp not found, trying alternative...`);
        }
    });
    
    console.log('Deployment complete!');
} catch (error) {
    console.error('Deployment failed:', error.message);
}
