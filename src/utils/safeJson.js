/**
 * Safe JSON Parse Utility
 * Provides error handling for JSON.parse operations
 */

const logger = require('./logger');

/**
 * Safely parse JSON string with error handling
 * @param {string} jsonString - JSON string to parse
 * @param {*} defaultValue - Default value if parsing fails
 * @param {string} context - Context for logging
 * @returns {*} Parsed object or default value
 */
function safeJsonParse(jsonString, defaultValue = null, context = 'unknown') {
    if (!jsonString) {
        return defaultValue;
    }

    try {
        return JSON.parse(jsonString);
    } catch (error) {
        logger.warn(`JSON parse error at ${context}:`, error.message);
        return defaultValue;
    }
}

/**
 * Safely parse JSON with array default
 * @param {string} jsonString - JSON string to parse
 * @param {string} context - Context for logging
 * @returns {Array} Parsed array or empty array
 */
function safeJsonArray(jsonString, context = 'unknown') {
    const result = safeJsonParse(jsonString, [], context);
    return Array.isArray(result) ? result : [];
}

/**
 * Safely parse JSON with object default
 * @param {string} jsonString - JSON string to parse
 * @param {string} context - Context for logging
 * @returns {Object} Parsed object or empty object
 */
function safeJsonObject(jsonString, context = 'unknown') {
    const result = safeJsonParse(jsonString, {}, context);
    return (result && typeof result === 'object' && !Array.isArray(result)) ? result : {};
}

module.exports = {
    safeJsonParse,
    safeJsonArray,
    safeJsonObject
};
