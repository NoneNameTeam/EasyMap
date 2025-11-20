import { Response } from "express";

export function formatResponse(res: Response, data: any, message = "Success", statusCode = 200) {
    return res.status(statusCode).json({
        "code": statusCode,
        "message":message,
        "data":data
    });
}