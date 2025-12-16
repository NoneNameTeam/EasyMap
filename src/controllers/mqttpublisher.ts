import { Request, Response } from "express";
import { MqttClient } from "mqtt"; // 需要安装 mqtt: npm install mqtt @types/mqtt
import { formatResponse } from "../utils/formatter.js";

// 定义预期接收的 Request Body 类型
interface MqttRequestPayload {
    topic: string;
    payload: any;
    qos?: 0 | 1 | 2;
    retain?: boolean;
}

export function PublishMqttMessage(mqttClient: MqttClient) {
    return async (req: Request, res: Response) => {
        // 强转 Body 类型以获取提示
        const body = req.body as MqttRequestPayload;

        // 1. 参数校验 (参考 CreateMapData 的风格)
        if (
            body.topic === undefined || body.topic === null ||
            typeof body.topic !== "string" || body.topic.trim() === ""
        ) {
            return formatResponse(res, null, "Invalid or missing 'topic'", 400);
        }

        if (body.payload === undefined || body.payload === null) {
            return formatResponse(res, null, "Missing 'payload'", 400);
        }

        // 2. 准备消息内容
        let messageToSend: string | Buffer;

        // 如果 payload 是对象，尝试转为 JSON 字符串
        if (typeof body.payload === "object") {
            try {
                messageToSend = JSON.stringify(body.payload);
            } catch (e) {
                return formatResponse(res, null, "Payload serialization failed", 400);
            }
        } else {
            messageToSend = String(body.payload);
        }

        const options = {
            qos: body.qos || 0,
            retain: body.retain || false
        };

        try {
            // 3. 发送 MQTT 消息 (将回调风格封装为 Promise)
            await new Promise<void>((resolve, reject) => {
                mqttClient.publish(body.topic, messageToSend, (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });

            // 4. 成功响应
            return formatResponse(res, {
                topic: body.topic,
                size: messageToSend.length,
                qos: options.qos
            }, "Message published successfully", 200);

        } catch (error) {
            console.error("Error publishing MQTT message:", error);
            return formatResponse(res, null, "Failed to publish MQTT message", 500);
        }
    };
}