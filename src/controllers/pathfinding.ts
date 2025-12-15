import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { formatResponse } from "../utils/formatter.js";
import { PathfindingService } from "../services/PathfindingService.js";

/**
 * 计算最优路径
 * POST /pathfinding/route
 */
export function calculateRoute(prisma: PrismaClient, astarUrl?:  string) {
    const pathfinder = new PathfindingService(prisma, astarUrl);

    return async (req: Request, res:  Response) => {
        try {
            const {
                startX,
                startY,
                targetX,
                targetY,
                considerTraffic = true,
                avoidEvents = true,
                preferredSpeed = 50
            } = req.body;

            if (
                typeof startX !== 'number' ||
                typeof startY !== 'number' ||
                typeof targetX !== 'number' ||
                typeof targetY !== 'number'
            ) {
                return formatResponse(
                    res,
                    null,
                    'Invalid coordinates:  startX, startY, targetX, targetY must be numbers',
                    400
                );
            }

            const result = await pathfinder.findPath(
                startX,
                startY,
                targetX,
                targetY,
                {
                    considerTraffic,
                    avoidEvents,
                    preferredSpeed
                }
            );

            if (! result.success) {
                return formatResponse(res, null, result.message || 'Path not found', 404);
            }

            formatResponse(res, {
                path: result.path,
                distance: result.distance,
                estimatedTime: result. estimatedTime,
                roads:  result.roads,
                keyPointCount: result.path?. length || 0,
                options: {
                    considerTraffic,
                    avoidEvents,
                    preferredSpeed
                }
            });

        } catch (error) {
            console.error('Calculate route error:', error);
            formatResponse(res, null, 'Failed to calculate route', 500);
        }
    };
}

/**
 * 获取推荐路径
 */
export function getRecommendedRoute(prisma: PrismaClient, astarUrl?: string) {
    const pathfinder = new PathfindingService(prisma, astarUrl);

    return async (req: Request, res:  Response) => {
        try {
            const { startX, startY, targetX, targetY } = req.body;

            if (
                typeof startX !== 'number' ||
                typeof startY !== 'number' ||
                typeof targetX !== 'number' ||
                typeof targetY !== 'number'
            ) {
                return formatResponse(res, null, 'Invalid coordinates', 400);
            }

            const result = await pathfinder. getRecommendedPath(
                startX,
                startY,
                targetX,
                targetY
            );

            if (!result.success) {
                return formatResponse(res, null, result.message || 'Path not found', 404);
            }

            formatResponse(res, {
                path: result.path,
                distance: result.distance,
                estimatedTime: result. estimatedTime,
                roads:  result.roads,
                routeType: 'recommended'
            });

        } catch (error) {
            console.error('Get recommended route error:', error);
            formatResponse(res, null, 'Failed to get recommended route', 500);
        }
    };
}

/**
 * 获取最短路径
 */
export function getShortestRoute(prisma: PrismaClient, astarUrl?:  string) {
    const pathfinder = new PathfindingService(prisma, astarUrl);

    return async (req: Request, res: Response) => {
        try {
            const { startX, startY, targetX, targetY } = req.body;

            if (
                typeof startX !== 'number' ||
                typeof startY !== 'number' ||
                typeof targetX !== 'number' ||
                typeof targetY !== 'number'
            ) {
                return formatResponse(res, null, 'Invalid coordinates', 400);
            }

            const result = await pathfinder.getShortestPath(
                startX,
                startY,
                targetX,
                targetY
            );

            if (!result.success) {
                return formatResponse(res, null, result.message || 'Path not found', 404);
            }

            formatResponse(res, {
                path: result.path,
                distance: result.distance,
                estimatedTime: result.estimatedTime,
                roads: result.roads,
                routeType: 'shortest'
            });

        } catch (error) {
            console.error('Get shortest route error:', error);
            formatResponse(res, null, 'Failed to get shortest route', 500);
        }
    };
}

/**
 * 基于关键点ID进行路径规划
 * POST /pathfinding/keypoints
 */
export function findPathBetweenKeyPoints(prisma: PrismaClient, astarUrl?: string) {
    const pathfinder = new PathfindingService(prisma, astarUrl);

    return async (req: Request, res: Response) => {
        try {
            const {
                startKeyPointId,
                targetKeyPointId,
                considerTraffic = true,
                avoidEvents = true,
                preferredSpeed = 50
            } = req.body;

            if (! startKeyPointId || !targetKeyPointId) {
                return formatResponse(
                    res,
                    null,
                    'startKeyPointId and targetKeyPointId are required',
                    400
                );
            }

            const result = await pathfinder.findPathBetweenKeyPoints(
                startKeyPointId,
                targetKeyPointId,
                {
                    considerTraffic,
                    avoidEvents,
                    preferredSpeed
                }
            );

            if (! result.success) {
                return formatResponse(res, null, result.message || 'Path not found', 404);
            }

            formatResponse(res, result);

        } catch (error) {
            console.error('Find path between key points error:', error);
            formatResponse(res, null, 'Failed to find path between key points', 500);
        }
    };
}

/**
 * 批量路径规划
 */
export function batchCalculateRoutes(prisma: PrismaClient, astarUrl?: string) {
    const pathfinder = new PathfindingService(prisma, astarUrl);

    return async (req: Request, res: Response) => {
        try {
            const { routes } = req.body;

            if (!Array.isArray(routes) || routes.length === 0) {
                return formatResponse(
                    res,
                    null,
                    'Invalid request: routes must be a non-empty array',
                    400
                );
            }

            const results = await Promise.all(
                routes.map(async (route:  any) => {
                    const { startX, startY, targetX, targetY, options } = route;

                    return {
                        input: { startX, startY, targetX, targetY },
                        result: await pathfinder.findPath(
                            startX,
                            startY,
                            targetX,
                            targetY,
                            options
                        )
                    };
                })
            );

            formatResponse(res, {
                total: results.length,
                successful: results.filter(r => r.result.success).length,
                failed: results.filter(r => ! r.result.success).length,
                results
            });

        } catch (error) {
            console.error('Batch calculate routes error:', error);
            formatResponse(res, null, 'Failed to batch calculate routes', 500);
        }
    };
}