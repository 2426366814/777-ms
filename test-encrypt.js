const EncryptionService = require('./src/services/EncryptionService');

const testKey = 'test-api-key-12345';
console.log('Original:', testKey);
const encrypted = EncryptionService.encrypt(testKey);
console.log('Encrypted:', encrypted.substring(0, 50) + '...');
const decrypted = EncryptionService.decrypt(encrypted);
console.log('Decrypted:', decrypted);
console.log('Match:', testKey === decrypted);

const db = require('./src/utils/database');

async function testDecrypt() {
    const providerKey = await db.queryOne('SELECT api_key FROM provider_api_keys WHERE provider_id = ?', ['zhipu']);
    if (providerKey) {
        console.log('\nProvider key preview:', providerKey.api_key.substring(0, 50) + '...');
        try {
            const decrypted = EncryptionService.decrypt(providerKey.api_key);
            console.log('Decrypted provider key:', decrypted.substring(0, 10) + '...');
        } catch (e) {
            console.error('Failed to decrypt provider key:', e.message);
        }
    }
    process.exit(0);
}

testDecrypt();
