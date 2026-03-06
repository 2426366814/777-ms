const axios = require('axios');
const db = require('../utils/database');

class LLMService {
    constructor() {
        this.providers = {};
        this.loadProviders();
    }

    async loadProviders() {
        try {
            const providers = await db.query('SELECT * FROM llm_providers WHERE is_active = 1 ORDER BY sort_order');
            providers.forEach(p => {
                let models = [];
                try {
                    models = JSON.parse(p.models || '[]');
                } catch (e) {
                    models = (p.models || '').split(',').map(m => m.trim()).filter(m => m);
                }
                
                this.providers[p.id] = {
                    id: p.id,
                    name: p.name,
                    displayName: p.display_name,
                    defaultModel: p.default_model,
                    baseUrl: p.base_url,
                    models: models,
                    icon: p.icon
                };
            });
            console.log(`[LLM] Loaded ${Object.keys(this.providers).length} providers`);
        } catch (error) {
            console.error('Failed to load providers:', error);
        }
    }

    getProvider(providerId) {
        return this.providers[providerId] || null;
    }

    getAllProviders() {
        return Object.values(this.providers);
    }

    async getUserConfig(userId, providerId) {
        const config = await db.queryOne(
            'SELECT * FROM user_llm_configs WHERE user_id = ? AND provider = ?',
            [userId, providerId]
        );
        return config;
    }

    async setUserConfig(userId, providerId, apiKey, customBaseUrl = null, customModel = null) {
        const existing = await this.getUserConfig(userId, providerId);
        
        if (existing) {
            await db.query(
                'UPDATE user_llm_configs SET api_key_encrypted = ?, custom_base_url = ?, custom_model = ?, updated_at = NOW() WHERE id = ?',
                [apiKey, customBaseUrl, customModel, existing.id]
            );
        } else {
            await db.query(
                'INSERT INTO user_llm_configs (user_id, provider, api_key_encrypted, custom_base_url, custom_model) VALUES (?, ?, ?, ?, ?)',
                [userId, providerId, apiKey, customBaseUrl, customModel]
            );
        }
        
        return { success: true };
    }

    async chat(userId, providerId, messages, options = {}) {
        const provider = this.getProvider(providerId);
        if (!provider) {
            throw new Error(`Provider ${providerId} not found`);
        }
        
        const userConfig = await this.getUserConfig(userId, providerId);
        const apiKey = userConfig?.api_key_encrypted || process.env[`${providerId.toUpperCase()}_API_KEY`];
        
        if (!apiKey) {
            throw new Error(`No API key configured for ${providerId}`);
        }
        
        const model = options.model || userConfig?.custom_model || provider.defaultModel;
        const baseUrl = userConfig?.custom_base_url || provider.baseUrl;
        
        const startTime = Date.now();
        let tokensUsed = 0;
        
        try {
            let response;
            
            if (providerId === 'anthropic') {
                response = await this.callAnthropic(baseUrl, apiKey, model, messages, options);
            } else if (providerId === 'google') {
                response = await this.callGoogle(baseUrl, apiKey, model, messages, options);
            } else {
                response = await this.callOpenAI(baseUrl, apiKey, model, messages, options);
            }
            
            tokensUsed = response.usage?.total_tokens || 0;
            
            await this.recordUsage(userId, providerId, model, tokensUsed, Date.now() - startTime, true);
            
            return response;
        } catch (error) {
            await this.recordUsage(userId, providerId, model, 0, Date.now() - startTime, false, error.message);
            throw error;
        }
    }

    async callOpenAI(baseUrl, apiKey, model, messages, options) {
        try {
            const response = await axios.post(
                `${baseUrl}/chat/completions`,
                {
                    model,
                    messages,
                    temperature: options.temperature || 0.7,
                    max_tokens: options.maxTokens || 2000,
                    stream: false
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            return {
                content: response.data.choices[0].message.content,
                model: response.data.model,
                usage: response.data.usage
            };
        } catch (error) {
            if (error.response) {
                console.error('API Error Response:', {
                    status: error.response.status,
                    data: error.response.data
                });
            }
            throw error;
        }
    }

    async callAnthropic(baseUrl, apiKey, model, messages, options) {
        const systemMessage = messages.find(m => m.role === 'system');
        const chatMessages = messages.filter(m => m.role !== 'system');
        
        const response = await axios.post(
            `${baseUrl}/messages`,
            {
                model,
                messages: chatMessages.map(m => ({
                    role: m.role === 'assistant' ? 'assistant' : 'user',
                    content: m.content
                })),
                system: systemMessage?.content,
                max_tokens: options.maxTokens || 2000
            },
            {
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                }
            }
        );
        
        return {
            content: response.data.content[0].text,
            model: response.data.model,
            usage: {
                prompt_tokens: response.data.usage.input_tokens,
                completion_tokens: response.data.usage.output_tokens,
                total_tokens: response.data.usage.input_tokens + response.data.usage.output_tokens
            }
        };
    }

    async callGoogle(baseUrl, apiKey, model, messages, options) {
        const contents = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));
        
        const response = await axios.post(
            `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
            {
                contents,
                generationConfig: {
                    temperature: options.temperature || 0.7,
                    maxOutputTokens: options.maxTokens || 2000
                }
            }
        );
        
        return {
            content: response.data.candidates[0].content.parts[0].text,
            model,
            usage: {
                total_tokens: 0
            }
        };
    }

    async streamChat(userId, providerId, messages, options, onChunk) {
        const provider = this.getProvider(providerId);
        if (!provider) {
            throw new Error(`Provider ${providerId} not found`);
        }
        
        const userConfig = await this.getUserConfig(userId, providerId);
        const apiKey = userConfig?.api_key_encrypted || process.env[`${providerId.toUpperCase()}_API_KEY`];
        
        if (!apiKey) {
            throw new Error(`No API key configured for ${providerId}`);
        }
        
        const model = options.model || userConfig?.custom_model || provider.defaultModel;
        const baseUrl = userConfig?.custom_base_url || provider.baseUrl;
        
        const response = await axios.post(
            `${baseUrl}/chat/completions`,
            {
                model,
                messages,
                temperature: options.temperature || 0.7,
                max_tokens: options.maxTokens || 2000,
                stream: true
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'stream'
            }
        );
        
        return new Promise((resolve, reject) => {
            let fullContent = '';
            
            response.data.on('data', (chunk) => {
                const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;
                        
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices[0]?.delta?.content || '';
                            if (content) {
                                fullContent += content;
                                onChunk(content);
                            }
                        } catch (e) {
                            logger.warn('Failed to parse SSE data chunk', { data: data.substring(0, 100), error: e.message });
                        }
                    }
                }
            });
            
            response.data.on('end', () => resolve({ content: fullContent }));
            response.data.on('error', reject);
        });
    }

    async recordUsage(userId, provider, model, tokens, responseTime, success, errorMessage = null) {
        try {
            await db.query(`
                INSERT INTO llm_usage_logs (user_id, provider, model, tokens_used, response_time_ms, success, error_message)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [userId, provider, model, tokens, responseTime, success ? 1 : 0, errorMessage]);
            
            await db.query(`
                INSERT INTO usage_stats (user_id, date, api_calls, tokens_used)
                VALUES (?, CURDATE(), 1, ?)
                ON DUPLICATE KEY UPDATE api_calls = api_calls + 1, tokens_used = tokens_used + VALUES(tokens_used)
            `, [userId, tokens]);
        } catch (error) {
            console.error('Failed to record usage:', error);
        }
    }

    async getUsageStats(userId, days = 30) {
        const stats = await db.query(`
            SELECT 
                provider,
                model,
                SUM(tokens_used) as total_tokens,
                COUNT(*) as total_calls,
                AVG(response_time_ms) as avg_response_time,
                SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_calls
            FROM llm_usage_logs
            WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY provider, model
        `, [userId, days]);
        
        return stats;
    }

    async testConnection({ provider, model, apiKey, baseUrl }) {
        const providerConfig = this.providers[provider];
        
        if (!providerConfig && !baseUrl) {
            throw new Error(`Provider ${provider} not found and no base URL provided`);
        }
        
        const actualBaseUrl = baseUrl || providerConfig?.baseUrl;
        const actualModel = model || providerConfig?.defaultModel || 'gpt-3.5-turbo';
        
        try {
            const testMessage = [{ role: 'user', content: 'Hello, this is a test message. Please respond with "OK".' }];
            
            const response = await axios.post(
                `${actualBaseUrl}/chat/completions`,
                {
                    model: actualModel,
                    messages: testMessage,
                    max_tokens: 10
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );
            
            return {
                success: true,
                message: 'Connection successful',
                model: response.data.model,
                provider: provider
            };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.error?.message || error.message,
                provider: provider
            };
        }
    }

    getAvailableModels() {
        const models = [];
        for (const [providerId, provider] of Object.entries(this.providers)) {
            if (provider.models) {
                provider.models.forEach(model => {
                    models.push({
                        id: `${providerId}:${model}`,
                        provider: providerId,
                        name: model,
                        displayName: `${provider.displayName || providerId} - ${model}`
                    });
                });
            }
            if (provider.defaultModel) {
                models.push({
                    id: `${providerId}:${provider.defaultModel}`,
                    provider: providerId,
                    name: provider.defaultModel,
                    displayName: `${provider.displayName || providerId} - ${provider.defaultModel}`
                });
            }
        }
        return models;
    }
}

const llmService = new LLMService();

module.exports = llmService;
