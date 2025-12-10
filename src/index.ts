import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { health } from "./controllers/health.js";
import { buildRouter } from "./routes/index.js";

// 初始化 Express 应用程序和 Prisma 客户端
const app = express();
const prisma = new PrismaClient();

app.use(buildRouter(prisma));
app.use(express.json());
app.use(cors({ origin: "*" }));
app.get("/health", async (req, res) => {
    return health(req,res);
})

app.listen(3000, () => {
    console.log('Server is running');
});