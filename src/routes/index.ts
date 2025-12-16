import express from "express";
import { PrismaClient } from "@prisma/client";
import {CreateMapData, getMapData, GetMapDataByLocation, UpdateMapData} from "../controllers/mapdata.js";
import {addNodeToObject, createObjectList, getObjectList} from "../controllers/objectdata.js";
import {
    createRoadConfig,
    getAllRoads,
    getRoadById,
    getRoadNetwork,
    deleteRoad,
    regenerateRoadLanes
} from "../controllers/roadConfig.js";
import mqtt from "mqtt";
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
    getRoadCongestionHistory,
    setLaneCongestion
} from "../controllers/trafficCongestion.js";

import {
    calculateRoute,
    getRecommendedRoute,
    getShortestRoute,
    batchCalculateRoutes,
    findPathBetweenKeyPoints
} from "../controllers/pathfinding.js";

import {
    getAllTrafficLights,
    getTrafficLightById,
    createTrafficLight,
    updateTrafficLightState,
    deleteTrafficLight,
    batchUpdateTrafficLights
} from "../controllers/trafficLight.js";

import {
    getAllParkingGates,
    getParkingGateById,
    createParkingGate,
    controlParkingGate,
    updateParkingGateStatus,
    deleteParkingGate
} from "../controllers/parkingGate.js";
import { PublishMqttMessage } from "../controllers/mqttpublisher.js";

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
    router.put("/roads/:roadId/lanes/:laneNumber/congestion", setLaneCongestion(prisma));

    // 路径规划路由
    const ASTAR_SERVICE_URL = process.env. ASTAR_SERVICE_URL || 'http://localhost:8080';

    router.post("/pathfinding/route", calculateRoute(prisma, ASTAR_SERVICE_URL));
    router.post("/pathfinding/recommended", getRecommendedRoute(prisma, ASTAR_SERVICE_URL));
    router.post("/pathfinding/shortest", getShortestRoute(prisma, ASTAR_SERVICE_URL));
    router.post("/pathfinding/keypoints", findPathBetweenKeyPoints(prisma, ASTAR_SERVICE_URL));
    router.post("/pathfinding/batch", batchCalculateRoutes(prisma, ASTAR_SERVICE_URL));

    //红绿灯API
    router.get("/traffic-lights", getAllTrafficLights(prisma));
    router.get("/traffic-lights/:id", getTrafficLightById(prisma));
    router.post("/traffic-lights", createTrafficLight(prisma));
    router.put("/traffic-lights/:id/state", updateTrafficLightState(prisma));
    router.delete("/traffic-lights/:id", deleteTrafficLight(prisma));
    router.post("/traffic-lights/batch", batchUpdateTrafficLights(prisma));

    //停车场大门API
    router.get("/parking-gates", getAllParkingGates(prisma));
    router.get("/parking-gates/:id", getParkingGateById(prisma));
    router.post("/parking-gates", createParkingGate(prisma));
    router.post("/parking-gates/:id/control", controlParkingGate(prisma));
    router.put("/parking-gates/:id/status", updateParkingGateStatus(prisma));
    router.delete("/parking-gates/:id", deleteParkingGate(prisma));


    //mqtt转发代码
    const mqttClient = mqtt.connect(process.env.MQTT_BROKER || 'mqtt://localhost:1883');
    router.post("/mqtt/publish", PublishMqttMessage(mqttClient));

    return router;
}