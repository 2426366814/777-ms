const db = require('../utils/database');

class ProviderRouterService {
    constructor() {
        this.strategies = {
            performance: { successRate: 0.5, latency: 0.35, quality: 0.15 },
            balanced: { successRate: 0.45, latency: 0.35, quality: 0.2 },
            roundRobin: { rotate: true }
        };
        
        this.providerMetrics = new Map();
        this.circuitStates = new Map();
        this.roundRobinIndex = 0;
    }

    async routeRequest(userId, model, messages, options = {}) {
        const strategy = options.strategy || 'balanced';
        const userPrefs = await this.getUserPreferences(userId);
        const providers = await this.getAvailableProviders(model);
        
        const candidates = providers.filter(p => {
            if (userPrefs.blockedProviders?.includes(p.id)) return false;
            if (this.isCircuitOpen(p.id)) return false;
            return true;
        });

        if (candidates.length === 0) {
            throw new Error('No available providers for this request');
        }

        let selectedProvider;
        
        if (strategy === 'roundRobin') {
            selectedProvider = this.selectRoundRobin(candidates);
        } else {
            const scored = await this.scoreProviders(candidates, strategy, userPrefs);
            selectedProvider = scored[0];
        }

        await this.logRoutingDecision(userId, model, candidates, selectedProvider, strategy);

        return selectedProvider;
    }

    async scoreProviders(providers, strategy, userPrefs) {
        const weights = this.strategies[strategy] || this.strategies.balanced;
        const scored = [];

        for (const provider of providers) {
            const metrics = await this.getProviderMetrics(provider.id);
            let score = 0;

            score = (metrics.successRate * weights.successRate) +
                    ((1 - metrics.avgLatency / 5000) * weights.latency) +
                    (metrics.quality * weights.quality);

            if (userPrefs.preferredProviders?.includes(provider.id)) {
                score *= 1.5;
            }

            scored.push({ ...provider, score, metrics });
        }

        return scored.sort((a, b) => b.score - a.score);
    }

    selectRoundRobin(providers) {
        const selected = providers[this.roundRobinIndex % providers.length];
        this.roundRobinIndex++;
        return selected;
    }

    isCircuitOpen(providerId) {
        const state = this.circuitStates.get(providerId);
        if (!state) return false;
        
        if (state.status === 'open') {
            const now = Date.now();
            if (now - state.lastFailure > 60000) {
                state.status = 'half-open';
                this.circuitStates.set(providerId, state);
                return false;
            }
            return true;
        }
        
        return false;
    }

    recordSuccess(providerId, latency) {
        const state = this.circuitStates.get(providerId) || {
            status: 'closed',
            failures: 0,
            successes: 0,
            lastFailure: 0
        };

        if (state.status === 'half-open') {
            state.successes++;
            if (state.successes >= 3) {
                state.status = 'closed';
                state.failures = 0;
                state.successes = 0;
            }
        } else {
            state.failures = 0;
        }

        this.circuitStates.set(providerId, state);
        this.updateMetrics(providerId, { success: true, latency });
    }

    recordFailure(providerId, error) {
        const state = this.circuitStates.get(providerId) || {
            status: 'closed',
            failures: 0,
            successes: 0,
            lastFailure: 0
        };

        state.failures++;
        state.lastFailure = Date.now();

        if (state.failures >= 5) {
            state.status = 'open';
            state.successes = 0;
        }

        this.circuitStates.set(providerId, state);
        this.updateMetrics(providerId, { success: false, error });
    }

    async updateMetrics(providerId, data) {
        const metrics = this.providerMetrics.get(providerId) || {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalLatency: 0,
            latencies: [],
            quality: 0.9
        };

        metrics.totalRequests++;
        
        if (data.success) {
            metrics.successfulRequests++;
            metrics.totalLatency += data.latency;
            metrics.latencies.push(data.latency);
            if (metrics.latencies.length > 100) {
                metrics.latencies.shift();
            }
        } else {
            metrics.failedRequests++;
        }

        metrics.successRate = metrics.successfulRequests / metrics.totalRequests;
        metrics.avgLatency = metrics.totalLatency / metrics.successfulRequests || 0;
        
        const sorted = [...metrics.latencies].sort((a, b) => a - b);
        metrics.p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
        metrics.p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
        metrics.p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

        this.providerMetrics.set(providerId, metrics);

        try {
            await db.query(`
                INSERT INTO provider_metrics (provider_id, success_rate, avg_latency, p50, p95, p99, total_requests, successful_requests, failed_requests)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    success_rate = VALUES(success_rate),
                    avg_latency = VALUES(avg_latency),
                    p50 = VALUES(p50),
                    p95 = VALUES(p95),
                    p99 = VALUES(p99),
                    total_requests = VALUES(total_requests),
                    successful_requests = VALUES(successful_requests),
                    failed_requests = VALUES(failed_requests),
                    updated_at = NOW()
            `, [providerId, metrics.successRate, metrics.avgLatency, metrics.p50, metrics.p95, metrics.p99, metrics.totalRequests, metrics.successfulRequests, metrics.failedRequests]);
        } catch (e) {
            console.error('Failed to update metrics:', e.message);
        }
    }

    async getProviderMetrics(providerId) {
        let metrics = this.providerMetrics.get(providerId);
        
        if (!metrics) {
            try {
                const rows = await db.query(
                    'SELECT * FROM provider_metrics WHERE provider_id = ?',
                    [providerId]
                );
                
                if (rows && rows.length > 0) {
                    const row = rows[0] || rows;
                    metrics = {
                        successRate: row.success_rate || 0.95,
                        avgLatency: row.avg_latency || 500,
                        p50: row.p50 || 400,
                        p95: row.p95 || 800,
                        p99: row.p99 || 1200,
                        quality: row.quality || 0.9
                    };
                }
            } catch (e) {
                console.error('Failed to get provider metrics:', e.message);
            }
        }

        return metrics || {
            successRate: 0.95,
            avgLatency: 500,
            p50: 400,
            p95: 800,
            p99: 1200,
            quality: 0.9
        };
    }

    async getAvailableProviders(model) {
        try {
            const rows = await db.query(`
                SELECT id, name, display_name, base_url, default_model, models
                FROM llm_providers
                WHERE is_active = 1
            `);

            return rows || [];
        } catch (e) {
            console.error('Failed to get available providers:', e.message);
            return [];
        }
    }

    async getUserPreferences(userId) {
        try {
            const rows = await db.query(
                'SELECT * FROM user_routing_preferences WHERE user_id = ?',
                [userId]
            );

            if (rows && rows.length > 0) {
                const row = rows[0] || rows;
                return {
                    strategy: row.strategy || 'balanced',
                    preferredProviders: row.preferred_providers ? JSON.parse(row.preferred_providers) : [],
                    blockedProviders: row.blocked_providers ? JSON.parse(row.blocked_providers) : []
                };
            }
        } catch (e) {
            console.error('Failed to get user preferences:', e.message);
        }

        return {
            strategy: 'balanced',
            preferredProviders: [],
            blockedProviders: []
        };
    }

    async setUserPreferences(userId, prefs) {
        try {
            await db.query(`
                INSERT INTO user_routing_preferences 
                (user_id, strategy, preferred_providers, blocked_providers)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    strategy = VALUES(strategy),
                    preferred_providers = VALUES(preferred_providers),
                    blocked_providers = VALUES(blocked_providers)
            `, [
                userId,
                prefs.strategy || 'balanced',
                JSON.stringify(prefs.preferredProviders || []),
                JSON.stringify(prefs.blockedProviders || [])
            ]);
        } catch (e) {
            console.error('Failed to set user preferences:', e.message);
        }
    }

    async logRoutingDecision(userId, model, candidates, selected, strategy) {
        try {
            await db.query(`
                INSERT INTO routing_decision_logs 
                (user_id, model, strategy, candidates_count, selected_provider, selected_score)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                userId,
                model,
                strategy,
                candidates.length,
                selected.id,
                selected.score
            ]);
        } catch (e) {
            console.error('Failed to log routing decision:', e.message);
        }
    }

    getCircuitBreakerStatus() {
        const status = {};
        for (const [providerId, state] of this.circuitStates) {
            status[providerId] = {
                status: state.status,
                failures: state.failures,
                successes: state.successes,
                lastFailure: state.lastFailure ? new Date(state.lastFailure).toISOString() : null
            };
        }
        return status;
    }

    getProviderStats() {
        const stats = {};
        for (const [providerId, metrics] of this.providerMetrics) {
            stats[providerId] = metrics;
        }
        return stats;
    }

    resetCircuitBreaker(providerId) {
        this.circuitStates.delete(providerId);
        return true;
    }

    async getAllProviders() {
        try {
            const rows = await db.query(`
                SELECT id, name, display_name, base_url, default_model, models, is_active, sort_order
                FROM llm_providers
                WHERE is_active = 1
                ORDER BY sort_order
            `);
            return rows || [];
        } catch (e) {
            console.error('Failed to get all providers:', e.message);
            return [];
        }
    }

    async getStrategies() {
        return [
            { id: 'balanced', name: '均衡模式', description: '优化所有因素，适用于通用场景', weights: this.strategies.balanced },
            { id: 'performance', name: '性能优先', description: '最大化速度和可靠性', weights: this.strategies.performance },
            { id: 'roundRobin', name: '轮询模式', description: '在提供商之间平均分配', weights: this.strategies.roundRobin }
        ];
    }

    async getRoutingLogs(limit = 50) {
        try {
            const rows = await db.query(`
                SELECT * FROM routing_decision_logs
                ORDER BY created_at DESC
                LIMIT ?
            `, [limit]);
            return rows || [];
        } catch (e) {
            console.error('Failed to get routing logs:', e.message);
            return [];
        }
    }
}

const providerRouterService = new ProviderRouterService();
module.exports = providerRouterService;
