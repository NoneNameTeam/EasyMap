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
            // 1. 检查智能红绿灯控制逻辑
            await this.checkSmartTrafficLights();
            
            // 2. 继续执行原有逻辑：管理绿灯和黄灯的时间限制
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

        } catch (error) {
            console.error('Error in AutoTrafficLightService:', error);
        }
    }
    
    /**
     * 智能红绿灯控制逻辑：检测到车辆在红绿灯前且其余方向没车就直接绿灯
     */
    private async checkSmartTrafficLights() {
        try {
            // 1. 获取所有自动模式的红绿灯组
            const lightGroups = await this.prisma.trafficLight.groupBy({
                by: ['groupId'],
                where: {
                    mode: 'AUTO',
                    groupId: { not: null }
                }
            });
            
            for (const group of lightGroups) {
                if (!group.groupId) continue;
                
                // 2. 获取该组内的所有红绿灯
                const groupLights = await this.prisma.trafficLight.findMany({
                    where: { groupId: group.groupId },
                    orderBy: { sequence: 'asc' }
                });
                
                // 3. 检查每个红绿灯前是否有车辆
                const lightsWithVehicles: { light: any; hasVehicle: boolean }[] = [];
                
                for (const light of groupLights) {
                    const hasVehicle = await this.hasVehicleInApproach(light);
                    lightsWithVehicles.push({ light, hasVehicle });
                }
                
                // 4. 检查是否只有一个方向有车辆
                const vehiclesCount = lightsWithVehicles.filter(item => item.hasVehicle).length;
                
                if (vehiclesCount === 1) {
                    // 5. 如果只有一个方向有车辆，且该方向是红灯，则切换为绿灯
                    const lightWithVehicle = lightsWithVehicles.find(item => item.hasVehicle);
                    if (lightWithVehicle && lightWithVehicle.light.state === 'RED') {
                        // 检查当前是否有绿灯或黄灯在运行
                        const hasActiveLight = groupLights.some(light => 
                            light.state === 'GREEN' || light.state === 'YELLOW'
                        );
                        
                        if (!hasActiveLight) {
                            console.log(`[SmartTraffic] Group ${group.groupId}: Switching light ${lightWithVehicle.light.id} to GREEN (only direction with vehicles)`);
                            // 切换到绿灯
                            await this.updateLight(lightWithVehicle.light.id, 'GREEN', 
                                lightWithVehicle.light.duration > 5 ? lightWithVehicle.light.duration : DEFAULT_DURATIONS.GREEN);
                            
                            // 确保组内其他灯为红灯
                            await this.prisma.trafficLight.updateMany({
                                where: {
                                    groupId: group.groupId,
                                    id: { not: lightWithVehicle.light.id }
                                },
                                data: { state: 'RED', lastChanged: new Date() }
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error in smart traffic light check:', error);
        }
    }
    
    /**
     * 检查红绿灯前一定范围内是否有车辆
     */
    private async hasVehicleInApproach(light: any): Promise<boolean> {
        try {
            const APPROACH_DISTANCE = 50; // 检测范围：50米
            
            // 获取该红绿灯关联的道路
            if (!light.roadId) return false;
            
            // 查询该道路上距离红绿灯一定范围内的车辆
            const vehicles = await this.prisma.vehicle.findMany({
                where: {
                    // 计算车辆是否在红绿灯前的一定范围内
                    // 这里使用简化的矩形范围检测，可以根据实际道路方向进行优化
                    currentX: {
                        gte: Math.floor(light.x - APPROACH_DISTANCE),
                        lte: Math.floor(light.x + APPROACH_DISTANCE)
                    },
                    currentY: {
                        gte: Math.floor(light.y - APPROACH_DISTANCE),
                        lte: Math.floor(light.y + APPROACH_DISTANCE)
                    },
                    // 只考虑最近更新的车辆（1分钟内）
                    updatedAt: {
                        gte: new Date(Date.now() - 60000)
                    }
                },
                take: 1 // 只要有一辆车就返回true
            });
            
            return vehicles.length > 0;
        } catch (error) {
            console.error('Error checking vehicles in approach:', error);
            return false;
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