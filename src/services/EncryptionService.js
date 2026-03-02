/**
 * 加密服务
 * 使用 AES-256-GCM 加密敏感数据
 */

const crypto = require('crypto');

class EncryptionService {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32;
        this.ivLength = 16;
        this.saltLength = 64;
        this.tagLength = 16;
        this.iterations = 100000;
        this.secretKey = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
    }
    
    deriveKey(password, salt) {
        return crypto.pbkdf2Sync(password, salt, this.iterations, this.keyLength, 'sha512');
    }
    
    encrypt(plaintext, password = null) {
        try {
            const salt = crypto.randomBytes(this.saltLength);
            const iv = crypto.randomBytes(this.ivLength);
            const key = this.deriveKey(password || this.secretKey, salt);
            
            const cipher = crypto.createCipheriv(this.algorithm, key, iv);
            
            let encrypted = cipher.update(plaintext, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();
            
            return {
                success: true,
                data: {
                    encrypted,
                    salt: salt.toString('hex'),
                    iv: iv.toString('hex'),
                    authTag: authTag.toString('hex')
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    decrypt(encryptedData, password = null) {
        try {
            const { encrypted, salt, iv, authTag } = encryptedData;
            
            const key = this.deriveKey(password || this.secretKey, Buffer.from(salt, 'hex'));
            
            const decipher = crypto.createDecipheriv(
                this.algorithm,
                key,
                Buffer.from(iv, 'hex')
            );
            
            decipher.setAuthTag(Buffer.from(authTag, 'hex'));
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return { success: true, data: decrypted };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    encryptMemory(memory) {
        if (!memory.content) {
            return { success: false, error: 'No content to encrypt' };
        }
        
        const result = this.encrypt(memory.content);
        
        if (result.success) {
            return {
                success: true,
                data: {
                    memoryId: memory.id,
                    encryptedContent: result.data.encrypted,
                    salt: result.data.salt,
                    iv: result.data.iv,
                    authTag: result.data.authTag
                }
            };
        }
        
        return result;
    }
    
    decryptMemory(encryptedMemory) {
        return this.decrypt({
            encrypted: encryptedMemory.encrypted_content || encryptedMemory.encryptedContent,
            salt: encryptedMemory.salt,
            iv: encryptedMemory.iv,
            authTag: encryptedMemory.auth_tag || encryptedMemory.authTag
        });
    }
    
    hashPassword(password) {
        const salt = crypto.randomBytes(this.saltLength);
        const hash = crypto.pbkdf2Sync(password, salt, this.iterations, this.keyLength, 'sha512');
        
        return {
            hash: hash.toString('hex'),
            salt: salt.toString('hex')
        };
    }
    
    verifyPassword(password, storedHash, storedSalt) {
        const hash = crypto.pbkdf2Sync(password, Buffer.from(storedSalt, 'hex'), this.iterations, this.keyLength, 'sha512');
        return hash.toString('hex') === storedHash;
    }
    
    generateApiKey() {
        const prefix = '777';
        const randomBytes = crypto.randomBytes(16).toString('hex');
        return `${prefix}_${randomBytes}`;
    }
    
    generateToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }
    
    hashData(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }
}

module.exports = new EncryptionService();
