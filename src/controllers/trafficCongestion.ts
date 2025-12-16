import { Request, Response } from "express";
import { PrismaClient, TrafficLevel } from "@prisma/client";
import { formatResponse } from "../utils/formatter.js";

/**
 * 获取指定路段的拥堵状态
 * GET /roads/:roadId/congestion
 */
export function getRoadCongestion(prisma: PrismaClient) {
    return async (req:  Request, res: Response) => {
        try {
            const { roadId } = req.params;

            // 1.获取道路信息
            const road = await prisma.road.findUnique({
                where: { id: roadId },
                include: {
                    centerLines:  true,
                    lanes: true,
                    keyPoints: true
                }
            });

            if (!road) {
                return formatResponse(res, null, "Road not found", 404);
            }

            // 2.获取该路段的所有节点及其交通状态
            const roadNodes = await prisma.mapNode.findMany({
                where: {
                    roadId: roadId,
                    block: 'ROAD'
                },
                select: {
                    id: true,
                    x: true,
                    y: true,
                    traffic: true,
                    event:  true,
                    updatedAt: true
                }
            });

            // 3.统计该路段的车辆数量
            const vehicleCount = await countVehiclesOnRoad(prisma, roadId);

            // 4.计算拥堵统计
            const trafficStats = calculateTrafficStats(roadNodes);

            // 5.获取路段平均速度
            const avgSpeed = await calculateAverageSpeed(prisma, roadId);

            const congestionData = {
                roadId: road.id,
                roadName: road.name,
                description: road.description,
                vehicleCount,
                nodeCount: roadNodes.length,
                averageSpeed: avgSpeed,
                trafficLevel: trafficStats.overallLevel,
                trafficDistribution: trafficStats.distribution,
                congestionPercentage: trafficStats.congestionPercentage,
                hasEvents: roadNodes.some(node => node.event !== null),
                lastUpdated: roadNodes.length > 0
                    ? roadNodes[0].updatedAt
                    : null,
                nodes: roadNodes
            };

            formatResponse(res, congestionData);
        } catch (error) {
            console.error("Get road congestion error:", error);
            formatResponse(res, null, "Failed to get road congestion", 500);
        }
    };
}

/**
 * 获取所有路段的拥堵概览
 * GET /roads/congestion/overview
 */
export function getAllRoadsCongestion(prisma: PrismaClient) {
    return async (req: Request, res: Response) => {
        try {
            const { level } = req.query; // 可选: 按交通等级过滤

            // 获取所有道路
            const roads = await prisma.road.findMany({
                include: {
                    centerLines:  true
                }
            });

            const congestionOverview = await Promise.all(
                roads.map(async (road) => {
                    const roadNodes = await prisma.mapNode.findMany({
                        where: {
                            roadId:  road.id,
                            block: 'ROAD'
                        }
                    });

                    const vehicleCount = await countVehiclesOnRoad(prisma, road.id);
                    const stats = calculateTrafficStats(roadNodes);

                    return {
                        roadId: road.id,
                        roadName: road.name,
                        trafficLevel: stats.overallLevel,
                        vehicleCount,
                        congestionPercentage: stats.congestionPercentage,
                        nodeCount: roadNodes.length
                    };
                })
            );

            // 按拥堵等级过滤
            let filtered = congestionOverview;
            if (level) {
                filtered = congestionOverview.filter(
                    item => item.trafficLevel === level
                );
            }

            // 按拥堵程度排序
            filtered.sort((a, b) =>
                b.congestionPercentage - a.congestionPercentage
            );

            formatResponse(res, {
                totalRoads: roads.length,
                overview: filtered,
                summary: {
                    smooth: filtered.filter(r => r.trafficLevel === 'SMOOTH').length,
                    normal: filtered.filter(r => r.trafficLevel === 'NORMAL').length,
                    congested:  filtered.filter(r => r.trafficLevel === 'CONGESTED').length,
                    unknown: filtered.filter(r => r.trafficLevel === 'UNKNOWN').length
                }
            });
        } catch (error) {
            console.error("Get all roads congestion error:", error);
            formatResponse(res, null, "Failed to get roads congestion overview", 500);
        }
    };
}

/**
 * 获取路段历史拥堵趋势
 * GET /roads/: roadId/congestion/history
 */
export function getRoadCongestionHistory(prisma: PrismaClient) {
    return async (req: Request, res:  Response) => {
        try {
            const { roadId } = req.params;
            const { hours = '24' } = req.query;

            const hoursNum = parseInt(hours as string);
            const startTime = new Date();
            startTime.setHours(startTime.getHours() - hoursNum);

            // 查询车辆历史记录
            const vehicleHistory = await prisma.vehicleLocationHistory.findMany({
                where: {
                    createdAt: {
                        gte: startTime
                    }
                },
                orderBy: {
                    createdAt: 'asc'
                }
            });

            // 按时间段分组统计
            const timeSlots = groupByTimeSlots(vehicleHistory, roadId, hoursNum);

            formatResponse(res, {
                roadId,
                period: {
                    hours: hoursNum,
                    start: startTime,
                    end: new Date()
                },
                history: timeSlots
            });
        } catch (error) {
            console.error("Get congestion history error:", error);
            formatResponse(res, null, "Failed to get congestion history", 500);
        }
    };
}

// ========== 辅助函数 ==========

/**
 * 统计路段上的车辆数量
 */
async function countVehiclesOnRoad(prisma: PrismaClient, roadId: string): Promise<number> {
    const roadNodes = await prisma.mapNode.findMany({
        where: {
            roadId: roadId,
            block: 'ROAD'
        },
        select: { x: true, y: true }
    });

    if (roadNodes.length === 0) return 0;

    // 计算路段的边界范围
    const xCoords = roadNodes.map(n => n.x);
    const yCoords = roadNodes.map(n => n.y);
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);

    // 统计范围内的车辆
    const vehicles = await prisma.vehicle.findMany({
        where: {
            currentX: { gte: minX, lte:  maxX },
            currentY: { gte: minY, lte: maxY }
        }
    });

    return vehicles.length;
}

/**
 * 计算交通统计数据
 */
function calculateTrafficStats(nodes: any[]) {
    if (nodes.length === 0) {
        return {
            overallLevel: 'UNKNOWN' as const,
            distribution: {
                UNKNOWN: 0,
                SMOOTH: 0,
                NORMAL: 0,
                CONGESTED: 0
            },
            congestionPercentage: 0
        };
    }

    const distribution = {
        UNKNOWN: 0,
        SMOOTH: 0,
        NORMAL: 0,
        CONGESTED: 0
    };

    nodes.forEach(node => {
        const level = node.traffic || 'UNKNOWN';
        distribution[level as keyof typeof distribution]++;
    });

    // 计算拥堵百分比
    const congestionPercentage =
        (distribution.CONGESTED / nodes.length) * 100;

    // 确定整体交通等级
    let overallLevel:  'UNKNOWN' | 'SMOOTH' | 'NORMAL' | 'CONGESTED' = 'UNKNOWN';

    if (congestionPercentage > 50) {
        overallLevel = 'CONGESTED';
    } else if (distribution.NORMAL / nodes.length > 0.5) {
        overallLevel = 'NORMAL';
    } else if (distribution.SMOOTH / nodes.length > 0.5) {
        overallLevel = 'SMOOTH';
    }

    return {
        overallLevel,
        distribution,
        congestionPercentage:  Math.round(congestionPercentage)
    };
}

/**
 * 计算路段平均速度
 */
async function calculateAverageSpeed(prisma: PrismaClient, roadId: string): Promise<number> {
    const roadNodes = await prisma.mapNode.findMany({
        where: { roadId, block: 'ROAD' },
        select: { x: true, y: true }
    });

    if (roadNodes.length === 0) return 0;

    const xCoords = roadNodes.map(n => n.x);
    const yCoords = roadNodes.map(n => n.y);
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);

    // 获取最近的车辆历史记录
    const recentHistory = await prisma.vehicleLocationHistory.findMany({
        where: {
            X: { gte: minX, lte: maxX },
            Y: { gte: minY, lte: maxY },
            createdAt: {
                gte: new Date(Date.now() - 5 * 60 * 1000) // 最近5分钟
            }
        },
        select: {
            vehicleId: true,
            X: true,
            Y: true,
            createdAt: true
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    if (recentHistory.length < 2) return 0;

    // 按车辆分组计算速度
    const vehicleGroups = new Map<string, typeof recentHistory>();
    recentHistory.forEach(record => {
        if (!vehicleGroups.has(record.vehicleId)) {
            vehicleGroups.set(record.vehicleId, []);
        }
        vehicleGroups.get(record.vehicleId)!.push(record);
    });

    let totalSpeed = 0;
    let speedCount = 0;

    vehicleGroups.forEach(records => {
        if (records.length < 2) return;

        for (let i = 0; i < records.length - 1; i++) {
            const curr = records[i];
            const prev = records[i + 1];

            const distance = Math.sqrt(
                Math.pow(curr.X - prev.X, 2) +
                Math.pow(curr.Y - prev.Y, 2)
            );

            const timeDiff =
                (curr.createdAt.getTime() - prev.createdAt.getTime()) / 1000;

            if (timeDiff > 0) {
                const speed = distance / timeDiff;
                totalSpeed += speed;
                speedCount++;
            }
        }
    });

    return speedCount > 0 ? Math.round(totalSpeed / speedCount) : 0;
}

/**
 * 按时间段分组历史数据
 */
function groupByTimeSlots(history: any[], roadId: string, hours: number) {
    const slotDuration = 60 * 60 * 1000; // 1小时
    const slots:  any[] = [];

    const now = Date.now();
    const startTime = now - (hours * 60 * 60 * 1000);

    for (let i = 0; i < hours; i++) {
        const slotStart = new Date(startTime + (i * slotDuration));
        const slotEnd = new Date(startTime + ((i + 1) * slotDuration));

        const slotData = history.filter(record => {
            const time = record.createdAt.getTime();
            return time >= slotStart.getTime() && time < slotEnd.getTime();
        });

        slots.push({
            time: slotStart,
            vehicleCount: slotData.length,
        });
    }

    return slots;
}

/**
 * 人工设置车道的拥堵情况
 * PUT /roads/:roadId/lanes/:laneNumber/congestion
 */
export function setLaneCongestion(prisma: PrismaClient) {
    return async (req: Request, res: Response) => {
        try {
            const { roadId, laneNumber } = req.params;
            const { trafficLevel } = req.body;

            // 1. 验证拥堵等级是否有效
            const validTrafficLevels = Object.values(TrafficLevel);
            if (!validTrafficLevels.includes(trafficLevel as TrafficLevel)) {
                return formatResponse(
                    res, 
                    null, 
                    `Invalid traffic level. Valid values: ${validTrafficLevels.join(', ')}`, 
                    400
                );
            }

            // 2. 获取指定车道
            const lane = await prisma.lane.findFirst({
                where: {
                    roadId,
                    laneNumber: parseInt(laneNumber)
                }
            });

            if (!lane) {
                return formatResponse(res, null, "Lane not found", 404);
            }

            // 3. 根据车道的起止点计算车道范围
            let nodesInLane: any[] = [];
            
            if (lane.startX === lane.endX) {
                // 垂直车道: x固定
                const minY = Math.min(lane.startY, lane.endY);
                const maxY = Math.max(lane.startY, lane.endY);
                
                // 计算车道的x范围（考虑车道宽度）
                const laneMinX = lane.startX - (lane.width / 2);
                const laneMaxX = lane.startX + (lane.width / 2);
                
                // 获取车道范围内的地图节点
                nodesInLane = await prisma.mapNode.findMany({
                    where: {
                        roadId,
                        block: 'ROAD',
                        x: { gte: Math.floor(laneMinX), lte: Math.ceil(laneMaxX) },
                        y: { gte: minY, lte: maxY }
                    }
                });
            } else {
                // 水平车道: y固定
                const minX = Math.min(lane.startX, lane.endX);
                const maxX = Math.max(lane.startX, lane.endX);
                
                // 计算车道的y范围（考虑车道宽度）
                const laneMinY = lane.startY - (lane.width / 2);
                const laneMaxY = lane.startY + (lane.width / 2);
                
                // 获取车道范围内的地图节点
                nodesInLane = await prisma.mapNode.findMany({
                    where: {
                        roadId,
                        block: 'ROAD',
                        x: { gte: minX, lte: maxX },
                        y: { gte: Math.floor(laneMinY), lte: Math.ceil(laneMaxY) }
                    }
                });
            }

            if (nodesInLane.length === 0) {
                return formatResponse(res, null, "No map nodes found in this lane", 404);
            }

            // 4. 更新车道内所有节点的拥堵状态
            await prisma.mapNode.updateMany({
                where: {
                    id: {
                        in: nodesInLane.map(node => node.id)
                    }
                },
                data: {
                    traffic: trafficLevel as TrafficLevel
                }
            });

            // 5. 返回更新结果
            const updatedNodes = await prisma.mapNode.findMany({
                where: {
                    id: {
                        in: nodesInLane.map(node => node.id)
                    }
                },
                select: {
                    id: true,
                    x: true,
                    y: true,
                    traffic: true
                }
            });

            formatResponse(
                res, 
                {
                    roadId,
                    laneNumber: lane.laneNumber,
                    direction: lane.direction,
                    updatedNodesCount: updatedNodes.length,
                    trafficLevel,
                    updatedNodes
                },
                "Lane congestion updated successfully",
                200
            );

        } catch (error) {
            console.error("Set lane congestion error:", error);
            formatResponse(res, null, "Failed to set lane congestion", 500);
        }
    };
}