# 777-MS Memory System

一个智能记忆管理系统，支持记忆存储、知识库管理、LLM对话、自动复习等功能。

## 功能特性

- **记忆管理**: CRUD操作、标签分类、重要性评分
- **知识库**: 知识条目管理、自动关联
- **LLM对话**: 多提供商支持、智能路由
- **自动复习**: 艾宾浩斯遗忘曲线
- **数据可视化**: 热力图、词云、网络图
- **安全认证**: JWT认证、数据加密

## 技术栈

- **后端**: Node.js + Express + MySQL
- **前端**: 原生HTML/CSS/JavaScript
- **AI**: 支持DeepSeek、OpenAI、Claude等

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填写实际配置
```

### 3. 初始化数据库

```bash
mysql -u root -p < database/schema.sql
```

### 4. 启动服务

```bash
npm start
# 或使用PM2
pm2 start server.js --name 777-ms
```

### 5. 访问系统

- 首页: http://localhost:1777
- 登录页: http://localhost:1777/login

## 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123456 | 管理员 |
| test | test123456 | 普通用户 |

## API文档

### 认证接口

- `POST /api/v1/users/login` - 登录
- `POST /api/v1/users/register` - 注册
- `POST /api/v1/users/logout` - 登出

### 记忆接口

- `GET /api/v1/memories` - 获取记忆列表
- `POST /api/v1/memories` - 创建记忆
- `PUT /api/v1/memories/:id` - 更新记忆
- `DELETE /api/v1/memories/:id` - 删除记忆

### 更多API请参考源码

## 目录结构

```
777-ms/
├── server.js           # 入口文件
├── src/
│   ├── routes/         # 路由文件
│   ├── services/       # 业务逻辑
│   ├── models/         # 数据模型
│   ├── middleware/     # 中间件
│   └── utils/          # 工具函数
├── web/                # 前端页面
├── database/           # 数据库脚本
└── logs/               # 日志文件
```

## 许可证

MIT License

## 作者

777-MS Team
