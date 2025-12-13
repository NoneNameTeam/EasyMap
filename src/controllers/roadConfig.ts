// src/controllers/roadConfig.ts

import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { formatResponse } from "../utils/formatter.js";

interface RoadConfig {
    name: string;
    description?: string;
    centerLines: {
        type: "HORIZONTAL" | "VERTICAL";
        value: number;      // y值(水平) 或 x值(垂直)
        start: number;      // 起始坐标
        end: number;        // 结束坐标
    }[];
    keyPoints: {
        name: string;
        x: number;
        y: number;
        type: "ENDPOINT" | "INTERSECTION" | "T_JUNCTION" | "CORNER" | "ENTRANCE";
        connectsTo?:  string[];  // 连接的关键点名称
    }[];
}

/**
 * 创建道路配置
 */
export function createRoadConfig(prisma:  PrismaClient) {
    return async (req:  Request, res: Response) => {
        try {
            const config: RoadConfig = req.body;

            // 1. 创建道路
            const road = await prisma.road.create({
                data: {
                    name: config.name,
                    description: config.description
                }
            });

            // 2. 创建中心线
            for (const centerLine of config.centerLines) {
                await prisma.centerLine.create({
                    data: {
                        roadId: road.id,
                        type: centerLine.type,
                        fixedAxis: centerLine.type === "HORIZONTAL" ? "Y" : "X",
                        fixedValue: centerLine.value,
                        startValue: centerLine.start,
                        endValue: centerLine.end
                    }
                });
            }

            // 3. 创建关键点
            const keyPointMap = new Map<string, string>(); // name -> id

            for (const kp of config.keyPoints) {
                const keyPoint = await prisma.keyPoint.create({
                    data: {
                        roadId: road.id,
                        name: kp.name,
                        x: kp.x,
                        y: kp.y,
                        type: kp.type,
                        connectedTo: []
                    }
                });
                keyPointMap.set(kp.name, keyPoint.id);
            }

            // 4. 建立关键点连接关系
            for (const kp of config.keyPoints) {
                if (kp.connectsTo && kp.connectsTo.length > 0) {
                    const connections = kp.connectsTo
                        .map(name => keyPointMap.get(name))
                        .filter(id => id !== undefined) as string[];

                    await prisma.keyPoint. update({
                        where: { id: keyPointMap.get(kp. name)! },
                        data: { connectedTo: connections }
                    });
                }
            }

            // 5. 自动生成车道
            await generateLanes(prisma, road. id, config);

            // 6. 返回完整配置
            const fullRoad = await prisma.road.findUnique({
                where: { id: road.id },
                include: {
                    centerLines: true,
                    keyPoints: true,
                    lanes: true
                }
            });

            formatResponse(res, fullRoad, "Road configuration created successfully", 201);

        } catch (error) {
            console.error("Error creating road config:", error);
            formatResponse(res, null, `Failed to create road config: ${error}`, 500);
        }
    };
}

/**
 * 自动生成车道
 */
async function generateLanes(prisma: PrismaClient, roadId: string, config: RoadConfig) {
    // 为每条中心线生成双向车道
    for (const centerLine of config.centerLines) {
        if (centerLine.type === "HORIZONTAL") {
            // 水平道路: y固定
            const y = centerLine.value;

            // 前向车道 (y + 4)
            await prisma.lane.create({
                data: {
                    roadId,
                    laneNumber: 1,
                    direction: "FORWARD",
                    startX: centerLine.start,
                    startY: y,
                    endX: centerLine.end,
                    endY: y,
                    width: 8,
                    centerOffset: 4
                }
            });

            // 后向车道 (y - 4)
            await prisma.lane.create({
                data: {
                    roadId,
                    laneNumber: 2,
                    direction: "BACKWARD",
                    startX: centerLine. start,
                    startY: y,
                    endX: centerLine.end,
                    endY: y,
                    width: 8,
                    centerOffset: -4
                }
            });

        } else {
            // 垂直道路: x固定
            const x = centerLine.value;

            // 前向车道 (x + 4)
            await prisma. lane.create({
                data: {
                    roadId,
                    laneNumber: 1,
                    direction: "FORWARD",
                    startX:  x,
                    startY:  centerLine.start,
                    endX: x,
                    endY: centerLine.end,
                    width: 8,
                    centerOffset: 4
                }
            });

            // 后向车道 (x - 4)
            await prisma.lane.create({
                data: {
                    roadId,
                    laneNumber: 2,
                    direction: "BACKWARD",
                    startX: x,
                    startY: centerLine. start,
                    endX:  x,
                    endY:  centerLine.end,
                    width: 8,
                    centerOffset: -4
                }
            });
        }
    }
}

/**
 * 获取所有道路配置
 */
export function getAllRoads(prisma: PrismaClient) {
    return async (req: Request, res: Response) => {
        try {
            const roads = await prisma.road.findMany({
                include: {
                    centerLines: true,
                    keyPoints: true,
                    lanes: true
                }
            });
            formatResponse(res, roads);
        } catch (error) {
            formatResponse(res, null, "Failed to get roads", 500);
        }
    };
}

/**
 * 获取单条道路详情
 */
export function getRoadById(prisma: PrismaClient) {
    return async (req:  Request, res: Response) => {
        try {
            const { id } = req.params;
            const road = await prisma. road.findUnique({
                where: { id },
                include: {
                    centerLines:  true,
                    keyPoints:  true,
                    lanes: true
                }
            });

            if (!road) {
                return formatResponse(res, null, "Road not found", 404);
            }

            formatResponse(res, road);
        } catch (error) {
            formatResponse(res, null, "Failed to get road", 500);
        }
    };
}

/**
 * 获取路网图（用于可视化）
 */
export function getRoadNetwork(prisma: PrismaClient) {
    return async (req: Request, res: Response) => {
        try {
            const roads = await prisma. road.findMany({
                include: {
                    centerLines:  true,
                    keyPoints:  true,
                    lanes: true
                }
            });

            // 构建图结构
            const nodes = roads.flatMap(road =>
                road.keyPoints.map(kp => ({
                    id: kp. id,
                    name: kp.name,
                    position: { x: kp.x, y: kp.y },
                    type: kp.type,
                    roadName: road.name
                }))
            );

            const edges = roads.flatMap(road =>
                road.keyPoints.flatMap(kp =>
                    kp.connectedTo.map(targetId => ({
                        from: kp.id,
                        to: targetId
                    }))
                )
            );

            formatResponse(res, { nodes, edges, roads });
        } catch (error) {
            formatResponse(res, null, "Failed to get road network", 500);
        }
    };
}

/**
 * 删除道路
 */
export function deleteRoad(prisma:  PrismaClient) {
    return async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            await prisma.road.delete({ where: { id } });
            formatResponse(res, { deleted: true });
        } catch (error) {
            formatResponse(res, null, "Failed to delete road", 500);
        }
    };
}