import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { formatResponse } from "../utils/formatter.js";

/**
 * 获取所有停车场大门
 */
export const getAllParkingGates = (prisma:  PrismaClient) => {
    return async (req: Request, res: Response) => {
        try {
            const { parkingLotId } = req.query;

            const gates = await prisma.parkingGate. findMany({
                where: parkingLotId ? { parkingLotId:  parkingLotId as string } : undefined,
                orderBy: { createdAt: 'desc' }
            });

            return formatResponse(res, gates);
        } catch (error) {
            console.error('Error fetching parking gates:', error);
            return formatResponse(res, null, "Failed to fetch parking gates", 500);
        }
    };
};

/**
 * 获取单个停车场大门
 */
export const getParkingGateById = (prisma: PrismaClient) => {
    return async (req: Request, res:  Response) => {
        try {
            const { id } = req.params;

            const gate = await prisma.parkingGate.findUnique({
                where: { id }
            });

            if (!gate) {
                return formatResponse(res, null, "Parking gate not found", 404);
            }

            return formatResponse(res, gate);
        } catch (error) {
            console.error('Error fetching parking gate:', error);
            return formatResponse(res, null, "Failed to fetch parking gate", 500);
        }
    };
};

/**
 * 创建停车场大门
 */
export const createParkingGate = (prisma: PrismaClient) => {
    return async (req: Request, res: Response) => {
        try {
            const { name, x, y, parkingLotId } = req.body;

            // 参数校验
            if (!name) {
                return formatResponse(res, null, "Missing required field: name", 400);
            }

            if (x === undefined || x === null || typeof x !== "number" || ! Number.isFinite(x)) {
                return formatResponse(res, null, "Invalid or missing 'x' value", 400);
            }

            if (y === undefined || y === null || typeof y !== "number" || !Number.isFinite(y)) {
                return formatResponse(res, null, "Invalid or missing 'y' value", 400);
            }

            const gate = await prisma.parkingGate.create({
                data: {
                    name,
                    x,
                    y,
                    parkingLotId:  parkingLotId || null
                }
            });

            return formatResponse(res, gate, "Parking gate created successfully", 201);
        } catch (error) {
            console.error('Error creating parking gate:', error);
            return formatResponse(res, null, "Failed to create parking gate", 500);
        }
    };
};

/**
 * 控制停车场大门开关
 */
export const controlParkingGate = (prisma: PrismaClient) => {
    return async (req:  Request, res: Response) => {
        try {
            const { id } = req.params;
            const { action } = req.body;

            // 验证 action 参数
            const validActions = ['OPEN', 'CLOSE'];
            if (!action || !validActions.includes(action)) {
                return formatResponse(
                    res,
                    null,
                    `Invalid action value. Must be one of: ${validActions.join(", ")}`,
                    400
                );
            }

            // 确定新状态和时间字段
            const newState = action === 'OPEN' ? 'OPENING' : 'CLOSING';

            const updateData: any = {
                state: newState
            };

            if (action === 'OPEN') {
                updateData.lastOpened = new Date();
            } else {
                updateData.lastClosed = new Date();
            }

            // 更新大门状态
            const gate = await prisma.parkingGate.update({
                where: { id },
                data: updateData
            });

            // TODO: 发布 MQTT 消息通知硬件设备
            // publishGateControl(id, action);

            return formatResponse(res, gate, "Gate control command sent successfully");
        } catch (error: any) {
            if (error.code === "P2025") {
                return formatResponse(res, null, "Parking gate not found", 404);
            }
            console.error('Error controlling parking gate:', error);
            return formatResponse(res, null, "Failed to control parking gate", 500);
        }
    };
};

/**
 * 更新停车场大门状态（用于接收硬件设备状态反馈）
 */
export const updateParkingGateStatus = (prisma: PrismaClient) => {
    return async (req:  Request, res: Response) => {
        try {
            const { id } = req.params;
            const { state } = req. body;

            // 验证状态值
            const validStates = ['OPEN', 'CLOSED', 'OPENING', 'CLOSING', 'ERROR'];
            if (! state || ! validStates.includes(state)) {
                return formatResponse(
                    res,
                    null,
                    `Invalid state value. Must be one of: ${validStates.join(", ")}`,
                    400
                );
            }

            const updateData: any = { state };

            // 根据状态更新相应的时间字段
            if (state === 'OPEN') {
                updateData.lastOpened = new Date();
            } else if (state === 'CLOSED') {
                updateData.lastClosed = new Date();
            }

            const gate = await prisma.parkingGate. update({
                where: { id },
                data: updateData
            });

            return formatResponse(res, gate, "Gate status updated successfully");
        } catch (error: any) {
            if (error.code === "P2025") {
                return formatResponse(res, null, "Parking gate not found", 404);
            }
            console.error('Error updating parking gate status:', error);
            return formatResponse(res, null, "Failed to update parking gate status", 500);
        }
    };
};

/**
 * 删除停车场大门
 */
export const deleteParkingGate = (prisma: PrismaClient) => {
    return async (req: Request, res: Response) => {
        try {
            const { id } = req.params;

            // 删除大门
            await prisma.parkingGate. delete({
                where: { id }
            });

            return formatResponse(res, { deleted: true }, "Parking gate deleted successfully");
        } catch (error:  any) {
            if (error.code === "P2025") {
                return formatResponse(res, null, "Parking gate not found", 404);
            }
            console.error('Error deleting parking gate:', error);
            return formatResponse(res, null, "Failed to delete parking gate", 500);
        }
    };
};