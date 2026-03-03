$files = @(
    'src/routes/memory.js',
    'src/routes/knowledge.js',
    'src/routes/tags.js',
    'src/routes/categories.js',
    'src/routes/session.js',
    'src/routes/chat.js',
    'src/routes/reminders.js',
    'src/routes/advanced.js',
    'src/routes/backup.js',
    'src/routes/share.js',
    'src/routes/versions.js',
    'src/routes/recommendations.js',
    'src/routes/usage.js'
);

Write-Host "=== Uploading security-fixed files to remote ===" -ForegroundColor Yellow;

foreach ($f in $files) {
    Write-Host "Uploading $f..." -NoNewline;
    $localPath = "e:\ai本地应用\记忆体\777-ms\$f";
    $remotePath = "/home/wwwroot/memory.91wz.org/$f";
    
    # Create directory if needed
    $dir = Split-Path $remotePath -Parent;
    C:\Windows\System32\OpenSSH\ssh.exe -p 1022 root@134.185.111.25 "mkdir -p $dir" 2>$null;
    
    # Upload file
    C:\Windows\System32\OpenSSH\scp.exe -P 1022 $localPath root@134.185.111.25:$remotePath 2>$null;
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host " Done" -ForegroundColor Green;
    } else {
        Write-Host " Failed" -ForegroundColor Red;
    }
}

Write-Host "";
Write-Host "Restarting PM2 service..." -ForegroundColor Yellow;
C:\Windows\System32\OpenSSH\ssh.exe -p 1022 root@134.185.111.25 "cd /home/wwwroot/memory.91wz.org && pm2 restart 777-ms" 2>$null;

Write-Host "";
Write-Host "Security fixes deployed!" -ForegroundColor Green;
