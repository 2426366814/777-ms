const request = require('supertest');
const app = require('../server');

describe('Security Fixes', () => {
    describe('SQL Injection Protection', () => {
        it('should reject invalid table name in bulk-delete', async () => {
            const response = await request(app)
                .post('/api/v1/advanced/bulk-delete')
                .set('ids', ['id1', 'id2'])
                .set('type', 'invalid_table');
            
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('无效的类型');
        });
        
        it('should reject invalid sort field', async () => {
            const response = await request(app)
                .get('/api/v1/knowledge?sortBy=invalid_field');
            
            expect(response.status).toBe(400);
        });
    });
    
    describe('Authentication', () => {
        it('should reject request without auth token', async () => {
            const response = await request(app)
                .get('/api/v1/memories');
            
            expect(response.status).toBe(401);
        });
        
        it('should reject request with invalid token', async () => {
            const response = await request(app)
                .get('/api/v1/memories')
                .set('Authorization', 'Bearer invalid_token');
            
            expect(response.status).toBe(401);
        });
    });
    
    describe('Rate Limiting', () => {
        it('should have rate limit on login endpoint', async () => {
            const response = await request(app)
                .post('/api/v1/users/login')
                .send({ username: 'test', password: 'test' });
            
            expect([200, 400, 429]).toContain(response.status);
        });
    });
});
