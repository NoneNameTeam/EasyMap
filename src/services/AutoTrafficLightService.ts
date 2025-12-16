import { PrismaClient, TrafficLight, TrafficLightState } from '@prisma/client';
import { TrafficControlService } from "./IotServices.js";

// 定义状态流转规则
const STATE_SEQUENCE = {
    [TrafficLightState.RED]: TrafficLightState.GREEN,
    [TrafficLightState.GREEN]: TrafficLightState.YELLOW,
    [TrafficLightState.YELLOW]: TrafficLightState.RED,
};

// 定义各状态的默认持续时间（秒）
// 你也可以选择在数据库中为每个红绿灯单独维护这些配置
const DEFAULT_DURATIONS = {
    [TrafficLightState.RED]: 30,    // 红灯亮30秒
    [TrafficLightState.GREEN]: 30,  // 绿灯亮30秒
    [TrafficLightState.YELLOW]: 3,  // 黄灯亮3秒
};

export class AutoTrafficLightService {
    private prisma: PrismaClient;
    private iotService: TrafficControlService;
    private intervalId: NodeJS.Timeout | null = null;
    private checkIntervalMs: number = 1000; // 每1秒检查一次

    constructor(prisma: PrismaClient, iotService: TrafficControlService) {
        this.prisma = prisma;
        this.iotService = iotService;
    }

    // 启动自动切换服务
    public start() {
        if (this.intervalId) return;
        console.log('🚦 Auto Traffic Light Service started...');
        this.intervalId = setInterval(() => this.checkAndSwitchLights(), this.checkIntervalMs);
    }

    // 停止服务
    public stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('🛑 Auto Traffic Light Service stopped.');
        }
    }

    private async checkAndSwitchLights() {
        try {
            // 1. 获取所有红绿灯
            // 为了性能，如果数据量极大，建议只查询 lastChanged 较早的数据
            // 这里假设红绿灯数量在可控范围内 (<1000)，全量查询通常没问题
            const lights = await this.prisma.trafficLight.findMany({
                where: {
                    mode: 'AUTO'
                }
            });
            const now = new Date();

            const updates = [];

            for (const light of lights) {
                // 计算经过的时间 (秒)
                const elapsedSeconds = (now.getTime() - new Date(light.lastChanged).getTime()) / 1000;

                // 2. 检查是否超过了持续时间
                if (elapsedSeconds >= light.duration) {
                    updates.push(this.switchLightState(light));
                }
            }

            // 3. 并行执行所有更新
            if (updates.length > 0) {
                await Promise.all(updates);
                // console.log(`Updated ${updates.length} traffic lights.`);
            }

        } catch (error) {
            console.error('Error in AutoTrafficLightService:', error);
        }
    }

    private async switchLightState(light: TrafficLight) {
        // 获取下一个状态
        const nextState = STATE_SEQUENCE[light.state];

        // 获取下一个状态应该持续的时间
        // 逻辑：如果是黄灯，通常时间很短。如果是红/绿，时间较长。
        // 如果你想保留用户在创建时设置的 duration (仅针对红/绿)，可以在这里做判断
        const nextDuration = DEFAULT_DURATIONS[nextState];

        try {
            // 更新数据库
            await this.prisma.trafficLight.update({
                where: { id: light.id },
                data: {
                    state: nextState,
                    duration: nextDuration,
                    lastChanged: new Date() // 重置计时器
                }
            });

            // 推送到 IoT 服务 (MQTT/WebSocket 等)
            if (this.iotService) {
                this.iotService.publishTrafficLightState(light.id, nextState, nextDuration);
            }
        } catch (error) {
            console.error(`Failed to update light ${light.id}:`, error);
        }
    }
}