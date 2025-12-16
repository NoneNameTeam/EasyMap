import express from 'express';
import { PrismaClient } from '@prisma/client';
import { buildRouter } from './routes/index.js';
import { VehicleLocationService } from './services/VehicleLocation.js';
import { initTrafficService } from './controllers/trafficLight.js';
import { initParkingService } from './controllers/parkingGate.js';
import {TrafficControlService} from "./services/IotServices";

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://localhost:1883';


// 创建 MQTT 服务实例
const trafficControlService = new TrafficControlService(prisma, MQTT_BROKER);

// 注入到 controllers
initTrafficService(trafficControlService);
initParkingService(trafficControlService);
// 构建路由
const router = buildRouter(prisma);
app.use('/', router);

// 健康检查
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: Date.now(),
        mqtt: {
            broker: MQTT_BROKER,
            topic: 'vehicle/+/info'
        }
    });
});

// 初始化MQTT车辆位置服务
let vehicleService:  VehicleLocationService;

try {
    vehicleService = new VehicleLocationService(prisma, MQTT_BROKER);
    console.log(`MQTT service initialized with broker: ${MQTT_BROKER}`);
    console.log('Subscribed to topic: vehicle/+/info');
} catch (error) {
    console.error('Failed to initialize MQTT service:', error);
}

// 优雅关闭
process. on('SIGINT', async () => {
    console.log('Shutting down gracefully...');

    if (vehicleService) {
        vehicleService.disconnect();
    }

    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down.. .');

    if (vehicleService) {
        vehicleService.disconnect();
    }

    await prisma.$disconnect();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`MQTT Topic Pattern: vehicle/{vehicleId}/info`);
    console.log(`Example: vehicle/esp32_001/info`);
});

export { vehicleService };