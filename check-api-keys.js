require('dotenv').config();
const db = require('./src/utils/database');

(async () => {
    try {
        const r = await db.query('SELECT * FROM user_api_keys ORDER BY created_at DESC LIMIT 5');
        console.log(JSON.stringify(r, null, 2));
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();
