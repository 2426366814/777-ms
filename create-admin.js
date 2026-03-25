const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

async function createAdmin() {
    const pool = mysql.createPool({
        host: '127.0.0.1',
        user: 'memory',
        password: 'ck123456@',
        database: 'memory'
    });
    
    const hashedPassword = await bcrypt.hash('Admin@123456', 10);
    const id = uuidv4();
    
    try {
        await pool.execute(
            'INSERT INTO users (id, username, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)',
            [id, 'admintest', 'admintest@test.com', hashedPassword, 'admin', 'active']
        );
        console.log('Admin user created: admintest / Admin@123456');
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
            console.log('User admintest already exists, updating password...');
            await pool.execute(
                'UPDATE users SET password = ? WHERE username = ?',
                [hashedPassword, 'admintest']
            );
            console.log('Password updated for admintest');
        } else {
            console.log('Error:', e.message);
        }
    }
    
    pool.end();
}

createAdmin();
