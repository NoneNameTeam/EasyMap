import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { formatResponse } from "../utils/formatter.js";
import { TrafficControlService } from "../services/IotServices.js";

let trafficService: TrafficControlService;

export function initTrafficService(service: TrafficControlService) {
    trafficService = service;
}

// 获取所有红绿灯
export const getAllTrafficLights = (prisma: PrismaClient) => {
    return async (req: Request, res: Response) => {
        try {
            const { roadId } = req.query;

            const lights = await prisma.trafficLight.findMany({
                where: roadId ? { roadId:  roadId as string } : undefined,
                orderBy: { createdAt: 'desc' }
            });

            formatResponse(res,lights);
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

            formatResponse(res,light);
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
            const { id } = req. params;
            const { state, duration, mode } = req.body;

            const updateData: any = {
                lastChanged: new Date() // 只要有更新，就重置计时器
            };

            if (state) {
                if (!['RED', 'YELLOW', 'GREEN'].includes(state)) {
                    return formatResponse(res, null, 'Invalid state.', 400);
                }
                updateData.state = state;
            }

            if (duration) {
                updateData.duration = duration;
            }

            if (mode) {
                if (!['AUTO', 'MANUAL'].includes(mode)) {
                    return formatResponse(res, null, 'Invalid mode. Must be AUTO or MANUAL', 400);
                }
                updateData.mode = mode;
            }

            const light = await prisma.trafficLight.update({
                where: { id },
                data: updateData
            });

            // 推送更新
            if (trafficService) {
                trafficService.publishTrafficLightState(id, light.state, light.duration);
            }

            formatResponse(res,light);
        } catch (error) {
            console.error('Error updating traffic light state:', error);
            formatResponse(res,null,'Failed to update traffic light',500);
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