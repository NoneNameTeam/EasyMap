import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { formatResponse } from "../utils/formatter.js";

/**
 * 获取车辆当前位置
 */
export function getVehicleCurrentLocation(prisma: PrismaClient) {
    return async (req:  Request, res: Response) => {
        try {
            const { vehicleId } = req.params;

            const vehicle = await prisma. vehicle.findUnique({
                where: { id: vehicleId }
            });

            if (!vehicle) {
                return formatResponse(res, null, "Vehicle not found", 404);
            }

            return formatResponse(res, vehicle);
        } catch (error) {
            console.error("Error getting vehicle location:", error);
            return formatResponse(res, null, "Internal server error", 500);
        }
    };
}

/**
 * 获取所有车辆当前位置
 */
export function getAllVehicles(prisma: PrismaClient) {
    return async (req: Request, res: Response) => {
        try {
            const { type, limit = "100", cursor } = req.query as Record<string, string>;

            const take = parseInt(limit);
            const skip = cursor ? 1 : 0;
            const cursorObj = cursor ? { id: cursor } : undefined;

            const vehicles = await prisma.vehicle. findMany({
                where: type ? { type } : undefined,
                take:  take + 1,
                skip: skip,
                cursor: cursorObj,
                orderBy: { updatedAt: 'desc' }
            });

            const hasNextPage = vehicles.length > take;
            const items = hasNextPage ? vehicles.slice(0, -1) : vehicles;
            const nextCursor = hasNextPage ?  items[items.length - 1]. id : null;

            return formatResponse(res, { items, nextCursor, hasNextPage });
        } catch (error) {
            console.error("Error getting vehicles:", error);
            return formatResponse(res, null, "Internal server error", 500);
        }
    };
}

/**
 * 获取车辆轨迹历史
 */
export function getVehicleTrajectory(prisma: PrismaClient) {
    return async (req: Request, res: Response) => {
        try {
            const { vehicleId } = req.params;
            const { startTime, endTime, limit = "100" } = req. query as Record<string, string>;

            const trajectory = await prisma.vehicleLocationHistory.findMany({
                where: {
                    vehicleId:  vehicleId,
                    ...(startTime && endTime ? {
                        createdAt: {
                            gte: new Date(startTime),
                            lte: new Date(endTime)
                        }
                    } : {})
                },
                orderBy: {
                    createdAt:  'desc'
                },
                take: parseInt(limit)
            });

            return formatResponse(res, trajectory);
        } catch (error) {
            console.error("Error getting vehicle trajectory:", error);
            return formatResponse(res, null, "Internal server error", 500);
        }
    };
}

/**
 * 获取指定区域内的车辆
 */
export function getVehiclesInArea(prisma: PrismaClient) {
    return async (req: Request, res: Response) => {
        try {
            const { minX, maxX, minY, maxY } = req.query as Record<string, string>;

            if (!minX || !maxX || !minY || !maxY) {
                return formatResponse(res, null, "Missing required parameters:  minX, maxX, minY, maxY", 400);
            }

            const vehicles = await prisma.vehicle.findMany({
                where: {
                    currentX: {
                        gte: parseInt(minX),
                        lte: parseInt(maxX)
                    },
                    currentY: {
                        gte: parseInt(minY),
                        lte: parseInt(maxY)
                    }
                }
            });

            return formatResponse(res, vehicles);
        } catch (error) {
            console.error("Error getting vehicles in area:", error);
            return formatResponse(res, null, "Internal server error", 500);
        }
    };
}

/**
 * 获取车辆最近的有效位置历史
 */
export function getVehicleValidHistory(prisma: PrismaClient) {
    return async (req: Request, res: Response) => {
        try {
            const { vehicleId } = req.params;
            const { limit = "50" } = req.query as Record<string, string>;

            const history = await prisma. vehicleLocationHistory.findMany({
                where: {
                    vehicleId: vehicleId,
                    valid: true
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: parseInt(limit)
            });

            return formatResponse(res, history);
        } catch (error) {
            console.error("Error getting vehicle valid history:", error);
            return formatResponse(res, null, "Internal server error", 500);
        }
    };
}

/**
 * 删除车辆及其历史数据
 */
export function deleteVehicle(prisma: PrismaClient) {
    return async (req: Request, res:  Response) => {
        try {
            const { vehicleId } = req.params;

            // 使用事务删除车辆和历史数据
            await prisma.$transaction([
                prisma.vehicleLocationHistory.deleteMany({
                    where: { vehicleId: vehicleId }
                }),
                prisma.vehicle.delete({
                    where: { id: vehicleId }
                })
            ]);

            return formatResponse(res, { deleted: true }, "Vehicle deleted successfully");
        } catch (error:  any) {
            if (error.code === "P2025") {
                return formatResponse(res, null, "Vehicle not found", 404);
            }
            console.error("Error deleting vehicle:", error);
            return formatResponse(res, null, "Internal server error", 500);
        }
    };
}

/**
 * 清理旧的历史数据
 */
export function cleanOldHistory(prisma: PrismaClient) {
    return async (req: Request, res: Response) => {
        try {
            const { days = "7" } = req. query as Record<string, string>;
            const daysToKeep = parseInt(days);

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            const result = await prisma.vehicleLocationHistory.deleteMany({
                where: {
                    createdAt: {
                        lt: cutoffDate
                    }
                }
            });

            return formatResponse(res, {
                deleted: result.count,
                cutoffDate: cutoffDate
            }, `Cleaned ${result.count} old records`);
        } catch (error) {
            console.error("Error cleaning old history:", error);
            return formatResponse(res, null, "Internal server error", 500);
        }
    };
}

/**
 * 获取车辆统计信息
 */
export function getVehicleStats(prisma:  PrismaClient) {
    return async (req: Request, res: Response) => {
        try {
            const [totalVehicles, vehiclesByType, recentActivity] = await Promise.all([
                // 总车辆数
                prisma.vehicle.count(),

                // 按类型分组统计
                prisma.vehicle. groupBy({
                    by: ['type'],
                    _count: {
                        id: true
                    }
                }),

                // 最近活跃的车辆(最近5分钟有更新)
                prisma.vehicle.count({
                    where: {
                        updatedAt: {
                            gte: new Date(Date.now() - 5 * 60 * 1000)
                        }
                    }
                })
            ]);

            return formatResponse(res, {
                totalVehicles,
                vehiclesByType,
                recentActivity
            });
        } catch (error) {
            console.error("Error getting vehicle stats:", error);
            return formatResponse(res, null, "Internal server error", 500);
        }
    };
}

/**
 * 注册车辆
 */
export function registerVehicle(prisma: PrismaClient) {
    return async (req: Request, res: Response) => {
        try {
            const { type, currentX, currentY, speed = 0, direction = "UNKNOWN", distance = 0, angle = 0 } = req.body;

            if (!type || currentX === undefined || currentY === undefined) {
                return formatResponse(res, null, "Missing required parameters: type, currentX, currentY", 400);
            }

            const vehicle = await prisma.vehicle.create({
                data: {
                    type,
                    currentX: parseInt(currentX),
                    currentY: parseInt(currentY),
                    speed: parseInt(speed),
                    direction,
                    distance: parseInt(distance),
                    angle: parseInt(angle)
                }
            });

            return formatResponse(res, vehicle, "Vehicle registered successfully", 201);
        } catch (error: any) {
            if (error.code === "P2002") {
                return formatResponse(res, null, "Vehicle already exists", 409);
            }
            console.error("Error registering vehicle:", error);
            return formatResponse(res, null, "Internal server error", 500);
        }
    };
}