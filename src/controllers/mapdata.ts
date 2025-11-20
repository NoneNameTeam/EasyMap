import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import {BlockCategory, MapNode, RoadEvent, TrafficLevel} from "../models/types.js";
import { formatResponse } from "../utils/formatter.js";

export function getMapData(prisma: PrismaClient) {
    return async (req: Request, res: Response) => {
        const { block, roadId } = req.query as Record<string, string>;
        const where: any = {};
        if (block) where.block = block;
        if (roadId) where.roadId = roadId;

        const mapNodes = await prisma.mapNode.findMany({
            where: where,
            select: {
                id: true,
                x: true,
                y: true,
                block: true,
                traffic: true,
                event: true,
                roadId: true,
                updatedAt: true
            }
        })
        formatResponse(res, mapNodes);
    };
}

export function GetMapDataByLocation(prisma: PrismaClient) {
    return async (req: Request, res: Response) => {
        const x = Number(req.params.x);
        const y = Number(req.params.y);

        const mapNode = await prisma.mapNode.findFirst({
            where: {
                x,
                y
            },
            select: {
                id: true,
                x: true,
                y: true,
                block: true,
                traffic: true,
                event: true,
                roadId: true,
                updatedAt: true
            }
        });
        if (!mapNode) return formatResponse(res, null, "Map node not found", 404);
        formatResponse(res, mapNode);
    }
}

export function CreateMapData(prisma: PrismaClient) {
    return async (req: Request, res: Response) => {
        const body = req.body as Partial<MapNode>;
        const mapNode = await prisma.mapNode.create({
            data: {
                x: body.x!,
                y: body.y!,
                block: body.block as BlockCategory,
                traffic: body.traffic as TrafficLevel,
                event: body.event as RoadEvent,
                roadId: body.roadId || null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }
        });
        formatResponse(res, mapNode, "Success",201);
    };
}

export function UpdateMapData(prisma: PrismaClient) {
    return async (req: Request, res: Response) => {
        const id = req.params.id;
        const data: any = {};
        const keys = [
            "block",
            "traffic",
            "event",
        ] as const;
        keys.forEach((k) => {
            if (k in req.body) data[k] = (req.body as any)[k];
        });

        if (Object.keys(data).length === 0) return formatResponse(res, null, "No data to update", 400);

        const node = await prisma.mapNode.update({
            where: { id },
            data
        });
        if (!node) return formatResponse(res, null, "Map node not found", 404);

        formatResponse(res, node, "Success");
    };
}