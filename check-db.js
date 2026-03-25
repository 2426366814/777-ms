require('dotenv').config();
const db = require('./src/utils/database');

(async () => {
    try {
        const result = await db.query('DESCRIBE user_api_keys');
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
})();
