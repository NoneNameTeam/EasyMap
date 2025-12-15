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
import {
    cleanOldHistory,
    deleteVehicle,
    getAllVehicles,
    getVehicleCurrentLocation, getVehiclesInArea,
    getVehicleStats,
    getVehicleTrajectory,
    getVehicleValidHistory,
    registerVehicle
} from "../controllers/vehicle.js";

import {
    getRoadCongestion,
    getAllRoadsCongestion,
    getRoadCongestionHistory
} from "../controllers/trafficCongestion.js";

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

    // 车辆位置路由
    router.get("/vehicles", getAllVehicles(prisma));
    router.post("/vehicles", registerVehicle(prisma));
    router.get("/vehicles/stats", getVehicleStats(prisma));
    router.get("/vehicles/:vehicleId", getVehicleCurrentLocation(prisma));
    router.get("/vehicles/:vehicleId/trajectory", getVehicleTrajectory(prisma));
    router.get("/vehicles/:vehicleId/history/valid", getVehicleValidHistory(prisma));
    router.delete("/vehicles/:vehicleId", deleteVehicle(prisma));
    router.get("/vehicles/area/search", getVehiclesInArea(prisma));
    router.delete("/vehicles/history/clean", cleanOldHistory(prisma));

    // 拥堵状态
    router.get("/roads/congestion/overview", getAllRoadsCongestion(prisma));
    router.get("/roads/:roadId/congestion", getRoadCongestion(prisma));
    router.get("/roads/:roadId/congestion/history", getRoadCongestionHistory(prisma));

    return router;
}