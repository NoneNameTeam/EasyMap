# 第一阶段：构建环境
FROM node:20 AS builder

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装所有依赖（包括开发依赖）
RUN npm ci

# 复制项目源代码
COPY . .

# 编译TypeScript代码
RUN npm run build

# 第二阶段：运行环境
FROM node:20-slim

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 只安装生产依赖
RUN npm ci --only=production

# 复制编译后的代码
COPY --from=builder /app/dist ./dist

# 复制Prisma模式文件
COPY --from=builder /app/prisma ./prisma

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production

# 启动应用
CMD ["node", "dist/index.js"]