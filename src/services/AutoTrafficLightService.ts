import { PrismaClient, TrafficLight, TrafficLightState } from '@prisma/client';
import { TrafficControlService } from "./IotServices.js";

const DEFAULT_DURATIONS = {
    [TrafficLightState.RED]: 0,     // 红灯是被动的，这里的时间设为0或无限均可，因为我们不自动轮询红灯
    [TrafficLightState.GREEN]: 10,  // 绿灯持续时间
    [TrafficLightState.YELLOW]: 2,  // 黄灯持续时间
};

export class AutoTrafficLightService {
    private prisma: PrismaClient;
    private iotService: TrafficControlService;
    private intervalId: NodeJS.Timeout | null = null;

    constructor(prisma: PrismaClient, iotService: TrafficControlService) {
        this.prisma = prisma;
        this.iotService = iotService;
    }

    public start() {
        if (this.intervalId) return;
        console.log('AutoTrafficLightService started.');
        // 每秒检查一次
        this.intervalId = setInterval(() => this.checkAndSwitchLights(), 1000);
    }

    public stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    private async checkAndSwitchLights() {
        try {
            // 1. 只查询当前处于 GREEN 或 YELLOW 状态的自动模式灯
            // 红灯是“静止”状态，不需要轮询，它等待被激活
            const activeLights = await this.prisma.trafficLight.findMany({
                where: {
                    mode: 'AUTO',
                    state: { in: ['GREEN', 'YELLOW'] }
                }
            });

            const now = new Date();

            for (const light of activeLights) {
                const elapsed = (now.getTime() - new Date(light.lastChanged).getTime()) / 1000;

                // 如果时间到了，切换状态
                if (elapsed >= light.duration) {
                    await this.handleStateTransition(light);
                }
            }

            // [可选] 故障恢复：如果某个组全是红灯（例如刚初始化），需要随机点亮一个
            // 这是一个较重的查询，生产环境建议单独起一个定时任务做这个检查
            // await this.recoverDeadlockGroups();

        } catch (error) {
            console.error('Error in AutoTrafficLightService:', error);
        }
    }

    private async handleStateTransition(light: TrafficLight) {
        // 情况 A: 绿 -> 黄
        if (light.state === 'GREEN') {
            await this.updateLight(light.id, 'YELLOW', DEFAULT_DURATIONS.YELLOW);
        }
        // 情况 B: 黄 -> 红 (并且激活下一个灯)
        else if (light.state === 'YELLOW') {
            // 1. 自己变红
            await this.updateLight(light.id, 'RED', 0); // 红灯duration不重要

            // 2. 如果有分组，激活下一个
            if (light.groupId) {
                await this.activateNextGreenLight(light.groupId, light.sequence);
            } else {
                // 如果没有分组（独立灯），直接变回绿
                await this.updateLight(light.id, 'GREEN', DEFAULT_DURATIONS.GREEN);
            }
        }
    }

    // 激活同组的下一个灯
    private async activateNextGreenLight(groupId: string, currentSequence: number) {
        // 1. 获取该组所有灯，按 sequence 排序
        const groupLights = await this.prisma.trafficLight.findMany({
            where: { groupId: groupId },
            orderBy: { sequence: 'asc' }
        });

        if (groupLights.length === 0) return;

        // 2. 找到下一个 sequence 的灯
        // 逻辑：找比当前 sequence 大的最小那个。如果没有，就找 sequence 最小的那个（回到起点）
        let nextLight = groupLights.find(l => l.sequence > currentSequence);

        if (!nextLight) {
            nextLight = groupLights[0]; // 循环回到第一个
        }

        // 3. 将下一个灯设为 GREEN
        // 注意：这里读取了 nextLight 数据库里配置的 duration，如果没有则用默认值
        // 这样你可以给主干道设置 60秒，支路设置 20秒
        const nextDuration = nextLight.duration > 5 ? nextLight.duration : DEFAULT_DURATIONS.GREEN;

        await this.updateLight(nextLight.id, 'GREEN', nextDuration);

        // 4. 双重保险：强制把组内【其他】所有灯设为 RED (防止因手动干扰导致的双绿灯)
        // 这一步在并发高时很重要
        await this.prisma.trafficLight.updateMany({
            where: {
                groupId: groupId,
                id: { not: nextLight.id }
            },
            data: { state: 'RED', lastChanged: new Date() }
        });
    }

    private async updateLight(id: string, state: TrafficLightState, duration: number) {
        const updated = await this.prisma.trafficLight.update({
            where: { id },
            data: {
                state,
                duration, // 更新 duration 以便前端倒计时准确
                lastChanged: new Date()
            }
        });

        if (this.iotService) {
            this.iotService.publishTrafficLightState(id, state, duration);
        }
    }
}