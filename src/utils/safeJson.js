/**
 * Safe JSON parsing utility with error handling
 * @param {string} jsonString - JSON string to parse
 * @param {*} defaultValue - Default value if parsing fails
 * @param {string} context - Context for logging (optional)
 * @returns {*} Parsed value or default value
 */
function safeJsonParse(jsonString, defaultValue = null, context = '') {
    if (!jsonString) {
        return defaultValue;
    }
    
    if (typeof jsonString !== 'string') {
        return jsonString;
    }
    
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        const logger = require('./logger');
        logger.warn('JSON parse failed', {
            context,
            error: error.message,
            inputPreview: jsonString.substring(0, 100)
        });
        return defaultValue;
    }
}

/**
 * Safe JSON stringify with error handling
 * @param {*} value - Value to stringify
 * @param {string} context - Context for logging (optional)
 * @returns {string} JSON string or empty string
 */
function safeJsonStringify(value, context = '') {
    if (value === null || value === undefined) {
        return '';
    }
    
    try {
        return JSON.stringify(value);
    } catch (error) {
        const logger = require('./logger');
        logger.warn('JSON stringify failed', {
            context,
            error: error.message
        });
        return '';
    }
}

module.exports = {
    safeJsonParse,
    safeJsonStringify
};
