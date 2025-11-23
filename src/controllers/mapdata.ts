import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import {BlockCategory, MapNode, RoadEvent, TrafficLevel} from "../models/types.js";
import { formatResponse } from "../utils/formatter.js";

export function getMapData(prisma: PrismaClient) {
    return async (req: Request, res: Response) => {
        const { block, roadId } = req.query as Record<string, string>;
        const where: any = {};
        if (block) {
            const validBlocks = Object.values(["BUILDING", "ROAD", "WATER"]);
            if (!validBlocks.includes(block)) {
                return formatResponse(res, null, `Invalid block value. Must be one of: ${validBlocks.join(", ")}`, 400);
            }
            where.block = block;
        }
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
        try {
            const x = Number(req.params.x);
            const y = Number(req.params.y);
            if (isNaN(x) || isNaN(y)) {
                return formatResponse(res, null, "Invalid coordinates", 400);
            }

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
            return formatResponse(res, mapNode);
        } catch (error) {
            return formatResponse(res, null, "Internal server error", 500);
        }
    }
}

export function CreateMapData(prisma: PrismaClient) {
    return async (req: Request, res: Response) => {
        const body = req.body as Partial<MapNode>;
        if (
            body.x === undefined || body.x === null ||
            typeof body.x !== "number" || !Number.isFinite(body.x) ||
            body.y === undefined || body.y === null ||
            typeof body.y !== "number" || !Number.isFinite(body.y)
        ) {
            return formatResponse(res, null, "Invalid or missing 'x' or 'y' value", 400);
        }
        try {
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
            formatResponse(res, mapNode, "Success", 201);
        } catch (error) {
            console.error("Error creating map node:", error);
            formatResponse(res, null, "Failed to create map node", 500);
        }
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
        // Define allowed enum values
        const validBlocks = ["BUILDING", "ROAD", "WATER"];
        const validTraffic = ["LOW", "MEDIUM", "HIGH"];
        const validEvents = ["NONE", "ACCIDENT", "CONSTRUCTION"];
        // Collect and validate values
        for (const k of keys) {
            if (k in req.body) {
                const value = (req.body as any)[k];
                if (k === "block" && value !== undefined && !validBlocks.includes(value)) {
                    return formatResponse(res, null, `Invalid block value. Must be one of: ${validBlocks.join(", ")}`, 400);
                }
                if (k === "traffic" && value !== undefined && !validTraffic.includes(value)) {
                    return formatResponse(res, null, `Invalid traffic value. Must be one of: ${validTraffic.join(", ")}`, 400);
                }
                if (k === "event" && value !== undefined && !validEvents.includes(value)) {
                    return formatResponse(res, null, `Invalid event value. Must be one of: ${validEvents.join(", ")}`, 400);
                }
                data[k] = value;
            }
        }

        if (Object.keys(data).length === 0) return formatResponse(res, null, "No data to update", 400);

        try {
            const node = await prisma.mapNode.update({
                where: { id },
                data
            });
            return formatResponse(res, node, "Success");
        } catch (error: any) {
            // Prisma throws a specific error code when record not found
            if (error.code === "P2025") {
                return formatResponse(res, null, "Map node not found", 404);
            }
            console.error("Error updating map node:", error);
            return formatResponse(res, null, "Failed to update map node", 500);
        }
    };
}