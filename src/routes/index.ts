import express from "express";
import { PrismaClient } from "@prisma/client";
import {CreateMapData, getMapData, GetMapDataByLocation, UpdateMapData} from "../controllers/mapdata.js";
import {addNodeToObject, createObjectList, getObjectList} from "../controllers/objectdata.js";
import {
    createRoadConfig,
    getAllRoads,
    getRoadById,
    getRoadNetwork,
    deleteRoad
} from "../controllers/roadConfig.js";

import cors from "cors";

export function buildRouter(prisma: PrismaClient){
    const router = express.Router();
    router.use(express.json({ limit: "10mb" }));
    router.use(cors({ origin: "*" }));

    router.get("/maps/data", getMapData(prisma));
    router.post("/maps/data", CreateMapData(prisma));
    router.put("/maps/data/:id", UpdateMapData(prisma));
    router.get("/maps/:x/:y", GetMapDataByLocation(prisma));

    router.get("/objects", getObjectList(prisma));
    router.put("/objects", createObjectList(prisma));
    router.post("/objects/:objectId/nodes", addNodeToObject(prisma));

    // 道路配置
    router.post("/roads", createRoadConfig(prisma));
    router.get("/roads", getAllRoads(prisma));
    router.get("/roads/:id", getRoadById(prisma));
    router.delete("/roads/:id", deleteRoad(prisma));
    router.get("/roads/network/graph", getRoadNetwork(prisma));

    router.get("/roads/network", getRoadNetwork(prisma));


    return router;
}