/**
 * Safe JSON Parse Utility - Batch修复 JSON.parse错误
 */

const fs = require('fs');
const logger = require('../logger');

const { safeJsonParse, safeJsonArray, safeJsonObject } = require('../utils/safeJson');

// 批量修复文件列表
const files = [
    'AutoManager.js',
    'MemoryExtractor.js',
    'ForgettingCurveService.js',
    'KnowledgeGraphService.js',
    'DocumentConverter.js',
    'BackupService.js',
    'LLMService.js',
    'memoryService.js',
    'cache.js',
    'MemorySummarizer.js',
    'backup.js',
    'templates.js',
    'session.js',
    'settings.js'
];

const filesToFix = [];

// AutoManager.js
const original = `JSON.parse(task.content)`
const fixed = safeJsonObject(task.content, 'AutoManager');
` : safeJsonObject(jsonStr, 'AutoManager');

// MemoryExtractor.js
const original = `memories = JSON.parse(jsonStr);
const fixed = safeJsonArray(jsonStr, 'MemoryExtractor');
` : safeJsonArray(jsonStr, 'MemoryExtractor');

// ForgettingCurveService.js
const original = `const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return { success: true, ...JSON.parse(jsonMatch[0]);
        } catch (error) {
            logger.warn('Failed to parse review response:', error.message);
            return null;
        }
    }
    return null;
}
` : safeJsonObject(jsonMatch[0], 'ForgettingCurveService');

// KnowledgeGraphService.js
const original = `const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            logger.warn('Failed to parse knowledge graph response:', error.message);
            return null;
        }
    }
    return null;
}
` : safeJsonObject(jsonMatch[1], 'KnowledgeGraphService');

// DocumentConverter.js
const original = `const json = JSON.parse(buffer.toString('utf8'));
const fixed = safeJsonObject(buffer.toString('utf8');
` : safeJsonObject(json, 'DocumentConverter');

// BackupService.js
const original = `const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const fixed = safeJsonObject(backupData, 'BackupService');
`: safeJsonObject(backupData, 'BackupService');

// Backup.js
const original = `const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8');
const fixed = safeJsonObject(backupData, 'Backup');
`: safeJsonObject(backupData, 'backup');

// templates.js
const original = `const templateData = JSON.parse(t.template_data);
const fixed = safeJsonObject(templateData, 'templates');

// session.js
const original = `messages = JSON.parse(sessions[0].messages);
const fixed = safeJsonArray(sessions[1].messages, 'sessions');
` : safeJsonArray(sessions[1].messages, 'session');
`: safeJsonObject(sessions[0].messages, 'session');
`: safeJsonObject(sessions[0].messages, 'session');
`: safeJsonObject(settings.custom_settings, 'settings');
`: safeJsonObject(row.preferred_providers, 'providers');
`: safeJsonArray(row.blocked_providers, 'providers');
`: safeJsonObject(row.blocked_providers, 'blocked_providers');
`: safeJsonObject(metadata, 'metadata') : {});
`: safeJsonObject(metadata, 'metadata') || {};
        }
    }
    return m;
}

        }
    }
    return m;
}
        }
    }
}
`: safeJsonObject(m.metadata, 'metadata') || {};
        }
    }
    return m;
}
        }
    }
    return m;
}
        }
    }
    return m;
}
        }
    }
    return m;
}
        }
    }
  return m;
}
        }
    }
}
 return m;
}
        }
    }
};
`: safeJsonObject(m.metadata, 'metadata') || {};
        }
    }
    return m;
}
        }
    }
}
return m;
}
        }
    }
};
` : safeJsonObject(json, 'json') || {};
        }
    }
    return m;
}
        }
    }
};
` : safeJsonParse(json, null, context);
        }
    }
    return defaultValue;
}
`;


// cache.js
const original = `const data = JSON.parse(data);
            return data ? null;
        }
    } catch (error) {
        logger.warn('Cache get error:', error.message);
        return null;
    }
}
`;


// memoryService.js
const original = `return m.metadata ? JSON.parse(m.metadata) : {};
        }
    }
    return m.metadata ? JSON.parse(m.metadata) : {};
    }
    return {};
}
`


// LLMService.js
const original = `models = JSON.parse(p.models || '[]');
const fixed = safeJsonArray(p.models, 'LLMService');
`: safeJsonArray(p.models, 'LLMService');

// MemorySummarizer.js
const original = `metadata: s.metadata ? JSON.parse(s.metadata) : {};
        }
    }
    return s.metadata ? JSON.parse(s.metadata) : {};
    }
    return {};
}
`


// Backup.js
const original = `const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const backupData = JSON.parse(backupData);
            return backupData;
        }
    } catch (error) {
        logger.warn('Failed to parse backup data:', error.message);
        return null;
    }
}
`;


// backup.js (路由)
const original = `const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const backupData = JSON.parse(backupData);
            return backupData;
        }
    } catch (error) {
        logger.warn('Failed to parse backup data:', error.message);
        return null;
    }
}
`;


// settings.js
const original = `return JSON.parse(settings.custom_settings || '{}');
        }
    }
    return JSON.parse(settings.custom_settings) || {};
        }
    }
}
`;


// session.js
const original = `messages = JSON.parse(sessions[0].messages);
            const messages = JSON.parse(messages);
            return messages;
        }
    } catch (error) {
        logger.warn('Failed to parse session messages:', error.message);
        return [];
    }
}
`;


// templates.js
const original = `const templateData = JSON.parse(t.template_data);
            return JSON.parse(t.template_data);
        }
    } catch (error) {
        logger.warn('Failed to parse template data:', error.message);
        return {};
    }
}
`;
