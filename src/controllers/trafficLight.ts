import {PrismaClient, TrafficLight} from '@prisma/client';
import { Request, Response } from 'express';
import { formatResponse } from "../utils/formatter.js";
import { TrafficControlService } from "../services/IotServices.js";

let trafficService: TrafficControlService;

export function initTrafficService(service: TrafficControlService) {
    trafficService = service;
}

const formatLightWithCountdown = (light: TrafficLight) => {
    const now = new Date();
    const lastChanged = new Date(light.lastChanged);

    // 计算经过的秒数
    const elapsedSeconds = (now.getTime() - lastChanged.getTime()) / 1000;

    // 计算剩余时间 (总时间 - 经过时间)
    // 使用 Math.ceil 向上取整，这样 29.1秒剩余会显示 30秒，比较符合人类直觉
    let remainingTime = Math.ceil(light.duration - elapsedSeconds);

    // 如果是手动模式，或者是负数（极少数情况），归零
    if (light.mode === 'MANUAL') {
        remainingTime = 0;
    } else if (remainingTime < 0) {
        remainingTime = 0;
    }

    return {
        ...light,
        remainingTime: remainingTime // 附加倒计时字段 (秒)
    };
};

// 获取所有红绿灯
export const getAllTrafficLights = (prisma: PrismaClient) => {
    return async (req: Request, res: Response) => {
        try {
            const { roadId } = req.query;

            const lights = await prisma.trafficLight.findMany({
                where: roadId ? { roadId:  roadId as string } : undefined,
                orderBy: { createdAt: 'desc' }
            });

            const result = lights.map(light => formatLightWithCountdown(light));

            formatResponse(res,result);
        } catch (error) {
            console.error('Error fetching traffic lights:', error);
            formatResponse(res,null,'Failed to fetch traffic lights',500);
        }
    };
};

// 获取单个红绿灯
export const getTrafficLightById = (prisma: PrismaClient) => {
    return async (req: Request, res:  Response) => {
        try {
            const { id } = req.params;

            const light = await prisma.trafficLight.findUnique({
                where: { id }
            });

            if (!light) {
                return formatResponse(res,null,'Failed to fetch traffic light',500);
            }

            formatResponse(res,formatLightWithCountdown(light));
        } catch (error) {
            console.error('Error fetching traffic light:', error);
            return formatResponse(res,null,'Failed to fetch traffic light',500);
        }
    };
};

// 创建红绿灯
export const createTrafficLight = (prisma: PrismaClient) => {
    return async (req: Request, res: Response) => {
        try {
            const { name, x, y, roadId, duration } = req.body;

            if (!name || x === undefined || y === undefined) {
                return formatResponse(res,null,'Missing the required data',400);
            }

            const light = await prisma.trafficLight.create({
                data: {
                    name,
                    x:  parseFloat(x),
                    y: parseFloat(y),
                    roadId,
                    duration: duration || 30
                }
            });

            formatResponse(res,light);
        } catch (error) {
            console.error('Error creating traffic light:', error);
            formatResponse(res,null,'Failed to create traffic light',500);
        }
    };
};

// 更新红绿灯状态
export const updateTrafficLightState = (prisma: PrismaClient) => {
    return async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { state, duration, mode, groupId } = req.body; // 假设允许更新 groupId

            // 1. 先查询这个灯的当前信息
            const currentLight = await prisma.trafficLight.findUnique({ where: { id } });
            if (!currentLight) return formatResponse(res, null, 'Light not found', 404);

            // 2. 准备更新数据
            const updateData: any = { lastChanged: new Date() };
            if (state) updateData.state = state;
            if (duration) updateData.duration = duration;
            if (mode) updateData.mode = mode;
            if (groupId !== undefined) updateData.groupId = groupId;

            // 3. 执行更新
            const updatedLight = await prisma.trafficLight.update({
                where: { id },
                data: updateData
            });

            // =====================================================
            // [新增] 互斥逻辑：如果手动设为 GREEN，且该灯属于某个组
            // =====================================================
            if (state === 'GREEN' && updatedLight.groupId) {
                // 强制将同组其他灯设为 RED
                await prisma.trafficLight.updateMany({
                    where: {
                        groupId: updatedLight.groupId,
                        id: { not: id } // 排除自己
                    },
                    data: {
                        state: 'RED',
                        lastChanged: new Date()
                    }
                });
            }

            // 发送 IoT 通知
            if (trafficService) {
                trafficService.publishTrafficLightState(id, updatedLight.state, updatedLight.duration);
            }

            // 返回数据 (包含前面做好的倒计时逻辑)
            // formatResponse(res, formatLightWithCountdown(updatedLight));
            formatResponse(res, updatedLight);

        } catch (error) {
            // ... error handling
        }
    };
};

// 删除红绿灯
export const deleteTrafficLight = (prisma: PrismaClient) => {
    return async (req: Request, res: Response) => {
        try {
            const { id } = req.params;

            await prisma.trafficLight.delete({
                where: { id }
            });

            formatResponse(res,{ deleted: true, message: 'Traffic light deleted successfully' })
        } catch (error) {
            console.error('Error deleting traffic light:', error);
            formatResponse(res,null,'Failed to delete traffic light',500);
        }
    };
};

// 批量更新红绿灯状态
export const batchUpdateTrafficLights = (prisma: PrismaClient) => {
    return async (req: Request, res: Response) => {
        try {
            const { updates } = req.body; // [{ id, state, duration }]

            if (!Array.isArray(updates)) {
                return formatResponse(res,null,'Updates must be an array',400)
            }

            const results = await Promise.all(
                updates.map(({ id, state, duration, mode }) =>
                    prisma.trafficLight.update({
                        where: { id },
                        data: {
                            state,
                            lastChanged: new Date(),
                            ...(mode && { mode }),
                            ...(duration && { duration })
                        }
                    })
                )
            );

            formatResponse(res,results);
        } catch (error) {
            console.error('Error batch updating traffic lights:', error);
            formatResponse(res,null,'Failed to update traffic light',500);
        }
    };
};