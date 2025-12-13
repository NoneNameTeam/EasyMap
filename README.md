# EasyMap

EasyMap是一个基于TypeScript、Express和Prisma构建的地图数据API服务，提供了地图节点和对象列表的管理功能。

## 技术栈

- **TypeScript** - 类型安全的JavaScript超集
- **Express** - 轻量级的Web应用框架
- **Prisma** - 现代化的ORM工具
- **Node.js** - JavaScript运行时环境

## 安装与设置

### 前提条件

- Node.js 18+ 和 npm
- 数据库（根据Prisma配置）

### 安装步骤

1. 克隆项目仓库：

```bash
git clone <repository-url>
cd EasyMap
```

2. 安装依赖：

```bash
npm install
```

3. 配置数据库：

编辑 `prisma/schema.prisma` 文件配置数据库连接，然后运行：

```bash
npx prisma migrate dev
```

4. 构建项目：

```bash
npm run build
```

## 运行项目

### 开发模式

```bash
npm run dev
```

### 生产模式

```bash
npm start
```

服务器默认运行在 `http://localhost:3000`

## API文档

完整的API文档请查看 [API.md](docs/API.md) 文件。

### 主要API端点

- `GET /maps/data` - 获取地图数据列表
- `POST /maps/data` - 创建新的地图数据
- `PUT /maps/data/:id` - 更新地图数据
- `GET /maps/:x/:y` - 按坐标获取地图数据
- `GET /objects` - 获取对象列表
- `PUT /objects` - 创建新的对象列表
- `POST /objects/:objectId/nodes` - 向对象添加节点
- `GET /health` - 健康检查

## 项目结构

```
├── src/
│   ├── controllers/       # API控制器
│   ├── models/            # 类型定义
│   ├── routes/            # 路由定义
│   ├── utils/             # 工具函数
│   └── index.ts           # 应用入口
├── prisma/               # Prisma配置
├── docs/                 # 文档
├── package.json          # 项目配置
├── tsconfig.json         # TypeScript配置
└── README.md             # 项目说明
```

## 许可证

ISC
