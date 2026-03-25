require('dotenv').config();
const db = require('./src/utils/database');

(async () => {
    try {
        const r = await db.query('DESCRIBE user_api_keys');
        console.log(JSON.stringify(r, null, 2));
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();
