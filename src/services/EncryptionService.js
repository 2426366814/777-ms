const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const ENCRYPTION_KEY_PATH = process.env.ENCRYPTION_KEY_PATH || path.join(process.cwd(), '.encryption_key');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;

let encryptionKey = null;

function getOrCreateEncryptionKey() {
    if (encryptionKey) return encryptionKey;
    
    try {
        if (fs.existsSync(ENCRYPTION_KEY_PATH)) {
            encryptionKey = fs.readFileSync(ENCRYPTION_KEY_PATH, 'utf8').trim();
            if (encryptionKey.length === 64) {
                return encryptionKey;
            }
        }
    } catch (err) {
        logger.warn('Failed to read encryption key:', err.message);
    }
    
    encryptionKey = crypto.randomBytes(32).toString('hex');
    
    try {
        const keyDir = path.dirname(ENCRYPTION_KEY_PATH);
        if (!fs.existsSync(keyDir)) {
            fs.mkdirSync(keyDir, { recursive: true });
        }
        fs.writeFileSync(ENCRYPTION_KEY_PATH, encryptionKey, { 
            mode: 0o600,
            encoding: 'utf8' 
        });
        logger.info('Generated new encryption key at:', ENCRYPTION_KEY_PATH);
    } catch (err) {
        logger.error('Failed to save encryption key:', err.message);
    }
    
    return encryptionKey;
}

function deriveKey(masterKey, salt) {
    return crypto.pbkdf2Sync(
        masterKey,
        salt,
        PBKDF2_ITERATIONS,
        32,
        'sha256'
    );
}

function encrypt(text) {
    if (!text || typeof text !== 'string') {
        throw new Error('Invalid text to encrypt');
    }
    
    const masterKey = getOrCreateEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);
    
    const derivedKey = deriveKey(masterKey, salt.toString('hex'));
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
    
    let encrypted = cipher.update(text, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const tag = cipher.getAuthTag();
    
    return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

function decrypt(encryptedData) {
    if (!encryptedData || typeof encryptedData !== 'string') {
        throw new Error('Invalid encrypted data');
    }
    
    const masterKey = getOrCreateEncryptionKey();
    const data = Buffer.from(encryptedData, 'base64');
    
    const salt = data.subarray(0, SALT_LENGTH);
    const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    
    const derivedKey = deriveKey(masterKey, salt.toString('hex'));
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
}

function hash(text) {
    if (!text || typeof text !== 'string') {
        throw new Error('Invalid text to hash');
    }
    return crypto.createHash('sha256').update(text).digest('hex');
}

function hashApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
        throw new Error('Invalid API key to hash');
    }
    return crypto.createHash('sha256').update(apiKey).digest('hex');
}

function mask(text, visibleChars = 4) {
    if (!text || typeof text !== 'string') {
        return '****';
    }
    const safeVisible = Math.max(0, Math.min(visibleChars, Math.floor(text.length / 2)));
    const start = text.substring(0, safeVisible);
    const end = text.substring(text.length - safeVisible);
    const middle = '*'.repeat(Math.max(4, text.length - safeVisible * 2));
    return `${start}${middle}${end}`;
}

function constantTimeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') {
        return false;
    }
    if (a.length !== b.length) {
        return false;
    }
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

module.exports = {
    encrypt,
    decrypt,
    hash,
    hashApiKey,
    mask,
    constantTimeCompare,
    getOrCreateEncryptionKey
};
