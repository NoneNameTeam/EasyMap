import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import {BlockCategory, MapNode, ObjectList, RoadEvent, TrafficLevel} from "../models/types.js";
import { formatResponse } from "../utils/formatter.js";

export function getObjectList(prisma: PrismaClient) {
    return async (req: Request, res: Response) => {
        const { objectId, roadId, cursor, limit } = req.query as Record<string, string>;
        const where: any = {};
        if (objectId) {
            where.id = objectId;
        }
        if(roadId){
            where.nodes = {
                some: {
                    roadId: roadId
                }
            };
        }
        const take = limit ? parseInt(limit) : 100;
        const skip = cursor ? 1 : 0;
        const cursorObj = cursor ? { id: cursor } : undefined;

        const result = await prisma.objectList.findMany({
            where: where,
            include: {
                nodes: {
                    select: {
                        id: true
                    }
                }
            },
            take: take + 1,
            skip: skip,
            cursor: cursorObj,
            orderBy: { id: 'asc' }
        });

        const hasNextPage = result.length > take;
        const items = hasNextPage ? result.slice(0, -1) : result;
        const nextCursor = hasNextPage ? items[items.length - 1].id : null;

        formatResponse(res, { items, nextCursor, hasNextPage });
    }
}
export function createObjectList(prisma: PrismaClient) {
    return async (req: Request, res: Response) => {
        const body = req.body as Partial<ObjectList>;
        // 基本参数校验
        if (!body) {
            return formatResponse(res, null, "请求体为空");
        }
        if (!body.name) {
            return formatResponse(res, null, "缺少字段: name");
        }
        if (!body.type) {
            return formatResponse(res, null, "缺少字段: type");
        }
        if (!body.nodes || !Array.isArray(body.nodes) || body.nodes.length === 0) {
            return formatResponse(res, null, "缺少字段: nodes，或 nodes 为空数组");
        }
        const blockType = body.type as BlockCategory;
        const nodes = body.nodes;
        // 分批处理的大小
        const batchSize = 500;

        try {
            // 首先创建ObjectList
            const objectList = await prisma.objectList.create({
                data: {
                    name: body.name,
                    type: blockType
                }
            });

            // 分批创建nodes
            const createdNodes = [];
            for (let i = 0; i < nodes.length; i += batchSize) {
                const batch = nodes.slice(i, i + batchSize);
                const batchNodes = await prisma.mapNode.createMany({
                    data: batch.map(n => ({
                        x: n.x,
                        y: n.y,
                        block: blockType,
                        traffic: 'UNKNOWN',
                        event: n.event ?? null,
                        roadId: objectList.id
                    })),
                    skipDuplicates: true // 跳过重复的节点（基于x,y的唯一索引）
                });
                createdNodes.push(batchNodes);
                // 可选：添加小延迟避免数据库压力过大
                if (i + batchSize < nodes.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            // 查询创建后的完整ObjectList（包括nodes）
            const ObjectListData = await prisma.objectList.findUnique({
                where: {
                    id: objectList.id
                },
                include: {
                    nodes: {
                        select: {
                            id: true
                        }
                    }
                }
            });

            formatResponse(res, ObjectListData);
        } catch (error) {
            console.error('Prisma error:', error);
            formatResponse(res, null, error instanceof Error ? error.message : '创建对象列表失败');
        }
    }
}

export function addNodeToObject(prisma: PrismaClient) {
    return async (req: Request, res: Response) => {
        const { objectId } = req.params as Record<string, string>;
        const { nodeId } = req.body as Record<string, string>;
        
        try {
            const updatedNode = await prisma.mapNode.update({
                where: {
                    id: nodeId
                },
                data: {
                    roadId: objectId
                }
            });

            const updatedObject = await prisma.objectList.findUnique({
                where: {
                    id: objectId
                },
                include: {
                    nodes: {
                        select: {
                            id: true
                        }
                    }
                }
            });
            
            formatResponse(res, updatedObject);
        } catch (error) {
            formatResponse(res, null, error instanceof Error ? error.message : '添加节点到对象列表失败');
        }
    }
}

