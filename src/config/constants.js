/**
 * 数据库字段常量配置
 * 集中管理所有查询字段，避免 SELECT * 和硬编码
 */

const DB_FIELDS = {
    USERS: {
        SAFE: 'id, username, email, role, status, created_at, updated_at, last_login_at',
        AUTH: 'id, username, email, password, role, status, created_at, updated_at',
        PROFILE: 'id, username, email, role, status, created_at, last_login_at',
        ADMIN_LIST: 'id, username, email, role, status, created_at, last_login_at'
    },
    
    MEMORIES: {
        FULL: 'id, user_id, content, type, category, importance, tags, metadata, created_at, updated_at',
        LIST: 'id, content, type, category, importance, tags, created_at, updated_at',
        PUBLIC: 'id, content, category, importance, created_at',
        EXPORT: 'id, content, type, category, importance, tags, metadata, created_at'
    },
    
    KNOWLEDGE: {
        FULL: 'id, user_id, title, content, category, tags, metadata, created_at, updated_at',
        LIST: 'id, title, content, category, tags, created_at, updated_at',
        PUBLIC: 'id, title, content, category, created_at',
        EXPORT: 'id, title, content, category, tags, metadata, created_at'
    },
    
    PUBLIC_KNOWLEDGE: {
        FULL: 'id, title, content, category, tags, source, metadata, priority, is_active, view_count, created_by, created_at, updated_at',
        LIST: 'id, title, category, tags, priority, view_count, created_at',
        SEARCH: 'id, title, content, category, tags, priority'
    },
    
    SESSIONS: {
        FULL: 'id, user_id, title, messages, created_at, updated_at',
        LIST: 'id, title, created_at, updated_at',
        EXPORT: 'id, title, messages, created_at'
    },
    
    SHARE_LINKS: {
        FULL: 'id, code, user_id, resource_type, resource_id, expires_at, created_at',
        PUBLIC: 'id, code, resource_type, expires_at, created_at'
    },
    
    LOGIN_LOGS: {
        FULL: 'id, user_id, ip_address, user_agent, status, login_at, created_at',
        LIST: 'id, user_id, ip_address, status, login_at',
        ADMIN: 'id, user_id, ip_address, user_agent, status, login_at, created_at'
    },
    
    SYSTEM_LOGS: {
        FULL: 'id, level, message, source, user_id, ip_address, created_at',
        LIST: 'id, level, message, source, created_at',
        ADMIN: 'id, level, message, source, user_id, ip_address, created_at'
    },
    
    USER_API_KEYS: {
        SAFE: 'id, user_id, name, created_at, expires_at, is_active, last_used_at',
        AUTH: 'id, user_id, api_key_hash, name, created_at, expires_at, is_active',
        LIST: 'id, name, created_at, expires_at, is_active, last_used_at'
    },
    
    LLM_PROVIDERS: {
        FULL: 'id, name, display_name, base_url, default_model, models, icon, is_active, sort_order, created_at, updated_at',
        LIST: 'id, name, display_name, base_url, default_model, models, icon, is_active, sort_order',
        ADMIN: 'id, name, display_name, base_url, default_model, models, icon, is_active, sort_order',
        PUBLIC: 'id, name, display_name, models',
        WITH_MODELS: 'id, name, models, default_model',
        BASIC: 'id, name, display_name, base_url, default_model, models, is_active',
        URL_MODEL: 'base_url, default_model'
    },
    
    LLM_USAGE_LOGS: {
        FULL: 'id, user_id, provider, model, tokens_used, cost, created_at',
        LIST: 'id, provider, model, tokens_used, cost, created_at'
    },
    
    USER_LLM_CONFIGS: {
        FULL: 'id, user_id, provider, api_key_encrypted, custom_base_url, custom_model, is_default, created_at, updated_at',
        LIST: 'id, provider, custom_base_url, custom_model, is_default, created_at'
    },
    
    CATEGORIES: {
        FULL: 'id, user_id, name, type, color, icon, sort_order, created_at, updated_at',
        LIST: 'id, name, type, color, icon, sort_order, created_at'
    },
    
    REMINDERS: {
        FULL: 'id, user_id, memory_id, reminder_type, reminder_time, is_sent, created_at',
        LIST: 'id, memory_id, reminder_type, reminder_time, is_sent, created_at'
    },
    
    BACKUP_HISTORY: {
        FULL: 'id, user_id, filename, file_size, backup_type, created_at',
        LIST: 'id, filename, file_size, backup_type, created_at'
    },
    
    API_LOGS: {
        FULL: 'id, user_id, endpoint, method, status_code, response_time, created_at',
        LIST: 'id, endpoint, method, status_code, response_time, created_at'
    },
    
    SECURITY_ALERTS: {
        FULL: 'id, user_id, alert_type, severity, message, is_resolved, created_at',
        LIST: 'id, alert_type, severity, message, is_resolved, created_at'
    },
    
    USER_SETTINGS: {
        FULL: 'id, user_id, setting_key, setting_value, updated_at',
        LIST: 'id, setting_key, setting_value, updated_at'
    },
    
    SYSTEM_SETTINGS: {
        FULL: 'id, setting_key, setting_value, description, updated_at',
        LIST: 'id, setting_key, setting_value, description'
    },
    
    REVIEW_ITEMS: {
        FULL: 'id, user_id, memory_id, next_review_at, review_count, ease_factor, interval, created_at, updated_at',
        LIST: 'id, memory_id, next_review_at, review_count, created_at'
    },
    
    MEMORY_RELATIONS: {
        FULL: 'id, source_id, target_id, relation_type, strength, created_at',
        LIST: 'id, source_id, target_id, relation_type, strength'
    },
    
    MEMORY_VERSIONS: {
        FULL: 'id, memory_id, content, version, created_at',
        LIST: 'id, memory_id, version, created_at'
    },
    
    MEMORY_TEMPLATES: {
        FULL: 'id, user_id, name, content, is_public, created_at, updated_at',
        LIST: 'id, name, is_public, created_at'
    },
    
    PROVIDER_MODELS: {
        FULL: 'id, provider_id, model_name, display_name, is_available, created_at',
        LIST: 'id, model_name, display_name, is_available'
    },
    
    PROVIDER_METRICS: {
        FULL: 'id, provider_id, total_requests, success_count, error_count, avg_latency, created_at, updated_at',
        LIST: 'id, provider_id, total_requests, success_count, avg_latency'
    },
    
    USER_ROUTING_PREFERENCES: {
        FULL: 'id, user_id, provider, priority, is_enabled, created_at, updated_at',
        LIST: 'id, provider, priority, is_enabled'
    },
    
    ROUTING_DECISION_LOGS: {
        FULL: 'id, user_id, request_id, selected_provider, reason, created_at',
        LIST: 'id, selected_provider, reason, created_at'
    },
    
    MEMORY_TAGS: {
        FULL: 'id, memory_id, tag_name, created_at',
        LIST: 'id, tag_name, created_at'
    },
    
    PROVIDER_API_KEYS: {
        FULL: 'id, provider_id, api_key_encrypted, is_active, created_at, updated_at',
        LIST: 'id, provider_id, is_active, created_at'
    }
};

const CONFIG = {
    JWT: {
        EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
        REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        DEFAULT_TTL_SECONDS: 86400,
        ISSUER: '777-ms',
        AUDIENCE: '777-ms-users'
    },
    
    BCRYPT: {
        SALT_ROUNDS: 10
    },
    
    HASH: {
        ALGORITHM: 'sha256'
    },
    
    SYSTEM_USER_ID: process.env.SYSTEM_USER_ID || null,
    
    PAGINATION: {
        DEFAULT_PAGE: 1,
        DEFAULT_LIMIT: 20,
        MAX_LIMIT: 100
    },
    
    BACKUP: {
        FILE_PREFIX: 'backup',
        TIMESTAMP_FORMAT: 'YYYYMMDDHHmmss'
    },
    
    RATE_LIMITS: {
        WINDOW_MS: {
            MINUTE: 60 * 1000,
            QUARTER_HOUR: 15 * 60 * 1000,
            HOUR: 60 * 60 * 1000,
            DAY: 24 * 60 * 60 * 1000
        },
        LOGIN: 5,
        REGISTER: 3,
        API_DEFAULT: 100,
        API_STRICT: 30,
        PASSWORD_RESET: 3,
        API_KEY_GENERATE: 10,
        CREATE: 100,
        IMPORT: 10
    },
    
    VALIDATION: {
        USERNAME: {
            MIN_LENGTH: 3,
            MAX_LENGTH: 50
        },
        PASSWORD: {
            MIN_LENGTH: 6,
            MAX_LENGTH: 100
        },
        EMAIL: {
            MAX_LENGTH: 100
        },
        CONTENT: {
            MAX_LENGTH: 10000
        },
        TITLE_MAX_LENGTH: 255,
        CATEGORY_MAX_LENGTH: 100,
        SOURCE_MAX_LENGTH: 255,
        PRIORITY_MIN: 0,
        PRIORITY_MAX: 100
    },
    
    IMPORT: {
        MAX_ITEMS: 100
    },
    
    API_KEY: {
        EXPIRES_INTERVAL: '1 YEAR',
        EXPIRES_DAYS: 365,
        PREFIX: '777_'
    }
};

const safeParseInt = (value, defaultValue, min = 1, max = 1000) => {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) return defaultValue;
    return Math.max(min, Math.min(max, parsed));
};

module.exports = { DB_FIELDS, CONFIG, safeParseInt };
