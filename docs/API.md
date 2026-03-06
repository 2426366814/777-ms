# 777-MS Memory System API 文档

## 基础信息

- **Base URL**: `https://memory.91wz.org`
- **API Version**: v1
- **认证方式**: Bearer Token

## 认证

### 登录

```http
POST /api/v1/user/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "username": "admin",
      "role": "admin"
    }
  }
}
```

### 使用Token

在请求头中添加：
```
Authorization: Bearer {token}
```

## 记忆管理

### 获取记忆列表

```http
GET /api/v1/memories?page=1&limit=20&category=work&search=关键词
Authorization: Bearer {token}
```

**参数**:
- `page`: 页码（默认: 1）
- `limit`: 每页数量（默认: 20，最大: 100）
- `category`: 分类筛选
- `tag`: 标签筛选
- `search`: 搜索关键词
- `sortBy`: 排序字段（createdAt, updatedAt, importance）
- `sortOrder`: 排序方向（asc, desc）

**响应**:
```json
{
  "success": true,
  "data": {
    "memories": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

### 创建记忆

```http
POST /api/v1/memories
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "记忆内容",
  "category": "工作",
  "tags": ["重要", "项目"],
  "importance": 8,
  "metadata": {
    "source": "manual",
    "priority": "high"
  }
}
```

### 更新记忆

```http
PUT /api/v1/memories/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "更新后的内容",
  "category": "更新后的分类",
  "tags": ["更新后的标签"]
}
```

### 删除记忆

```http
DELETE /api/v1/memories/{id}
Authorization: Bearer {token}
```

## 知识管理

### 获取知识列表

```http
GET /api/v1/knowledge?page=1&limit=20
Authorization: Bearer {token}
```

### 创建知识

```http
POST /api/v1/knowledge
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "知识标题",
  "content": "知识内容",
  "category": "分类",
  "tags": ["标签1", "标签2"]
}
```

## 标签管理

### 获取标签列表

```http
GET /api/v1/tags
Authorization: Bearer {token}
```

### 创建标签

```http
POST /api/v1/tags
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "新标签",
  "color": "#FF5733"
}
```

## 分类管理

### 获取分类列表

```http
GET /api/v1/categories
Authorization: Bearer {token}
```

### 创建分类

```http
POST /api/v1/categories
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "新分类",
  "description": "分类描述"
}
```

## LLM提供商

### 获取LLM提供商列表

```http
GET /api/v1/providers
Authorization: Bearer {token}
```

### 添加LLM提供商

```http
POST /api/v1/providers
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "deepseek",
  "apiKey": "your-api-key",
  "baseUrl": "https://api.deepseek.com",
  "model": "deepseek-chat"
}
```

## 管理员功能

### 获取统计信息

```http
GET /api/v1/admin/stats
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "totalMemories": 100,
    "totalUsers": 10,
    "totalKnowledge": 50,
    "totalTags": 25,
    "totalCategories": 10
  }
}
```

### 获取用户列表

```http
GET /api/v1/admin/users?page=1&limit=20
Authorization: Bearer {token}
```

### 创建用户

```http
POST /api/v1/admin/users
Authorization: Bearer {token}
Content-Type: application/json

{
  "username": "newuser",
  "password": "password123",
  "email": "user@example.com",
  "role": "user"
}
```

## 错误响应

所有错误响应格式：

```json
{
  "success": false,
  "message": "错误描述",
  "errors": [...]
}
```

### 常见HTTP状态码

- `200 OK`: 请求成功
- `201 Created`: 资源创建成功
- `400 Bad Request`: 请求参数错误
- `401 Unauthorized`: 未认证或Token无效
- `403 Forbidden`: 无权限访问
- `404 Not Found`: 资源不存在
- `500 Internal Server Error`: 服务器内部错误

## 安全说明

### SQL注入防护

系统已实现SQL注入防护，以下payload会被拒绝：

- `' OR '1'='1`
- `'; DROP TABLE users; --`
- `1; SELECT * FROM users`
- `' UNION SELECT * FROM memories --`

### XSS防护

系统已实现XSS防护，所有用户输入都会经过净化处理。

### 速率限制

API实现了速率限制，防止滥用。

## 权限说明

### 用户角色

- **admin**: 管理员，拥有所有权限
- **user**: 普通用户，只能访问自己的数据

### 权限隔离

- 普通用户无法访问管理员端点
- 用户只能访问自己创建的记忆、知识等数据
- 越权访问会被403拒绝

## 使用示例

### JavaScript

```javascript
// 登录
const loginResponse = await fetch('https://memory.91wz.org/api/v1/user/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'admin123'
  })
});
const { token } = await loginResponse.json().data;

// 获取记忆列表
const memoriesResponse = await fetch('https://memory.91wz.org/api/v1/memories?page=1&limit=20', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { memories, pagination } = await memoriesResponse.json().data;

// 创建记忆
const createResponse = await fetch('https://memory.91wz.org/api/v1/memories', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    content: '新记忆',
    category: '工作',
    tags: ['重要']
  })
});
```

### cURL

```bash
# 登录
curl -X POST https://memory.91wz.org/api/v1/user/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 获取记忆列表
curl https://memory.91wz.org/api/v1/memories?page=1&limit=20 \
  -H "Authorization: Bearer YOUR_TOKEN"

# 创建记忆
curl -X POST https://memory.91wz.org/api/v1/memories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"content":"新记忆","category":"工作","tags":["重要"]}'
```

## 更新日志

### v1.0.0 (2026-03-04)
- 初始版本
- 完整API文档
- SQL注入防护
- XSS防护
- 多用户权限隔离
