import express from "express";
import { PrismaClient } from "@prisma/client";
import {CreateMapData, getMapData, GetMapDataByLocation, UpdateMapData} from "../controllers/mapdata.js";

export function buildRouter(prisma: PrismaClient){
    const router = express.Router();

    router.get("/maps/data", getMapData(prisma));
    router.post("/maps/data", CreateMapData(prisma));
    router.put("/maps/data/:id", UpdateMapData(prisma));

    router.get("/maps/:x/:y", GetMapDataByLocation(prisma));

    return router;
}