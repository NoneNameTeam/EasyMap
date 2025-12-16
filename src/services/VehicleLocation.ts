import mqtt from 'mqtt';
import { PrismaClient } from '@prisma/client';
import { LocationFilter, VehicleLocation } from '../utils/LocationFilter.js';
import { MapMatcher, MatchResult } from '../utils/MapMatcher.js';

// ESP32端发送的原始数据格式
interface ESP32LocationData {
    vehicle_id:  string;
    valid: boolean;
    x: number;
    y: number;
    distance: number;
    angle: number;
    direction: string;
    timestamp: number;
    events: number;
}

export class VehicleLocationService {
    private mqttClient: mqtt. MqttClient;
    private locationFilter: LocationFilter;
    private mapMatcher: MapMatcher;

    constructor(
        private prisma: PrismaClient,
        mqttBrokerUrl: string
    ) {
        this.locationFilter = new LocationFilter();
        this.mapMatcher = new MapMatcher(prisma);
        this.mqttClient = mqtt.connect(mqttBrokerUrl);

        this.setupMqttHandlers();
    }

    private setupMqttHandlers() {
        this.mqttClient. on('connect', () => {
            console. log('Connected to MQTT broker');
            // 订阅车辆位置主题:  vehicle/+/info (+ 是通配符,匹配任意车辆ID)
            this.mqttClient.subscribe('vehicle/+/info', (err) => {
                if (err) {
                    console.error('Subscribe error:', err);
                } else {
                    console.log('Successfully subscribed to vehicle/+/info');
                }
            });
        });

        this.mqttClient.on('message', async (topic, message) => {
            try {
                // 从主题中提取车辆ID:  vehicle/esp32_001/info -> esp32_001
                const vehicleId = this.extractVehicleIdFromTopic(topic);

                if (!vehicleId) {
                    console.error('Could not extract vehicle ID from topic:', topic);
                    return;
                }

                const rawData:ESP32LocationData = JSON.parse(message.toString());

                // 标准化数据,添加默认值
                const data: VehicleLocation = this.normalizeESP32Data(rawData, vehicleId);

                console.log(`[${vehicleId}] Received:  valid=${data.valid}, pos=(${data.x.toFixed(2)}, ${data.y.toFixed(2)}), direction=${data.direction}`);

                await this.processVehicleLocation(data);
            } catch (error) {
                console.error('Error processing message from topic', topic, ':', error);
            }
        });

        this.mqttClient. on('error', (error) => {
            console.error('MQTT Error:', error);
        });

        this.mqttClient. on('reconnect', () => {
            console.log('MQTT Reconnecting...');
        });

        this.mqttClient. on('offline', () => {
            console. log('MQTT Client offline');
        });
    }

    /**
     * 从MQTT主题中提取车辆ID
     * 主题格式: vehicle/{vehicleId}/info
     */
    private extractVehicleIdFromTopic(topic: string): string | null {
        const match = topic.match(/^vehicle\/([^\/]+)\/info$/);
        return match ? match[1] : null;
    }

    /**
     * 将ESP32数据标准化为VehicleLocation格式
     * ESP32端数据:  x, y 已经是厘米单位,需要转换为米
     */
    private normalizeESP32Data(rawData: ESP32LocationData, vehicleId: string): VehicleLocation {
        // 判断车辆类型 (可以根据vehicle_id前缀判断,如esp32开头的为SENSOR_CAR)
        const vehicleType = this.inferVehicleType(vehicleId);

        // ESP32发送的x, y是经过 round(x * 100) / 100. 0 处理的,单位应该是米
        // 如果原始单位是厘米,需要除以100转换为米
        const x = rawData.x; // 假设已经是米
        const y = rawData. y;

        return {
            vehicle_id: rawData.vehicle_id || vehicleId,
            type: vehicleType,
            valid: rawData.valid,
            x: x,
            y: y,
            distance: rawData.distance / 10.0, // 从分米转换为米 (round(distance * 10) / 10.0)
            angle: rawData.angle,
            direction: rawData.direction || '未知',
            error: 0, // ESP32端没有发送error字段,默认为0
            timestamp: Math.floor(Date.now() / 1000),
            events: rawData.events || 0,
            rssi: -999 // ESP32端没有发送RSSI,使用默认值
        };
    }

    /**
     * 根据车辆ID推断车辆类型
     */
    private inferVehicleType(vehicleId: string): string {
        if (vehicleId.startsWith('esp32')) {
            return 'SENSOR_CAR'; // 传感器车
        } else if (vehicleId.startsWith('car')) {
            return 'CAR';
        } else if (vehicleId.startsWith('truck')) {
            return 'TRUCK';
        } else {
            return 'UNKNOWN';
        }
    }

    async processVehicleLocation(data:  VehicleLocation) {
        try {
            // 1. 保存原始历史数据
            await this.saveLocationHistory(data);

            // 2. 去噪处理
            const filtered = this. locationFilter.process(data);

            if (!filtered) {
                console.log(`[${data.vehicle_id}] Filtered out (invalid data)`);
                return;
            }

            // 3. 地图匹配
            const matched = await this.mapMatcher. matchToMap(filtered. x, filtered.y);

            if (! matched || matched.confidence < 0.3) {
                console.log(`[${data.vehicle_id}] Low confidence:  ${(matched?. confidence || 0).toFixed(2)}, using filtered position`);
                // 即使置信度低也更新车辆位置,但使用过滤后的坐标
                await this.updateVehiclePosition(data. vehicle_id, {
                    x: Math.round(filtered.x),
                    y: Math.round(filtered.y),
                    type: data.type,
                    direction: data.direction,
                    distance: data.distance,
                    angle: data.angle,
                    speed: await this.calculateSpeed(data.vehicle_id, filtered.x, filtered.y, data.timestamp)
                });
                return;
            }

            console.log(`[${data.vehicle_id}] Matched:  confidence=${matched.confidence.toFixed(2)}, road=${matched.roadId || 'none'}, pos=(${matched.matched.x.toFixed(1)}, ${matched.matched.y.toFixed(1)})`);

            // 4. 更新车辆当前位置
            await this. updateVehiclePosition(data. vehicle_id, {
                x: Math.round(matched.matched.x),
                y: Math.round(matched.matched.y),
                type: data.type,
                direction: data.direction,
                distance: data.distance,
                angle: data.angle,
                speed: await this. calculateSpeed(data.vehicle_id, matched.matched.x, matched.matched.y, data.timestamp)
            });

            // 5. 更新道路交通状态
            if (matched.roadId) {
                await this.updateTrafficStatus(matched.roadId);
            }

        } catch (error) {
            console.error(`[${data.vehicle_id}] Error in processVehicleLocation:`, error);
        }
    }

    /**
     * 保存车辆位置历史记录
     */
    private async saveLocationHistory(data: VehicleLocation) {
        try {
            await this.prisma.vehicleLocationHistory.create({
                data: {
                    vehicleId: data.vehicle_id,
                    X: Math.round(data.x),
                    Y: Math.round(data.y),
                    type: data.type,
                    direction: data.direction,
                    distance: data.distance,
                    angle: data.angle,
                    valid: data.valid,
                    events: data.events,
                    rssi: data.rssi,
                    createdAt: new Date(data.timestamp * 1000)
                }
            });
        } catch (error) {
            console.error(`[${data.vehicle_id}] Error saving location history:`, error);
        }
    }

    /**
     * 更新车辆当前位置
     */
    private async updateVehiclePosition(
        vehicleId: string,
        position: {
            x: number;
            y: number;
            type: string;
            direction:  string;
            distance: number;
            angle: number;
            speed: number;
        }
    ) {
        try {
            await this.prisma.vehicle.upsert({
                where: { id: vehicleId },
                update: {
                    currentX:  position.x,
                    currentY: position.y,
                    type: position.type,
                    direction: position.direction,
                    distance: position.distance,
                    angle: position.angle,
                    speed: position.speed,
                    updatedAt: new Date()
                },
                create: {
                    id: vehicleId,
                    currentX: position.x,
                    currentY: position.y,
                    type: position.type,
                    direction: position.direction,
                    distance: position.distance,
                    angle: position.angle,
                    speed: position.speed
                }
            });
        } catch (error) {
            console.error(`[${vehicleId}] Error updating vehicle position:`, error);
        }
    }

    /**
     * 计算车辆速度 (基于历史位置)
     */
    private async calculateSpeed(vehicleId: string, x: number, y: number, timestamp: number): Promise<number> {
        try {
            // 获取最近的历史记录
            const lastHistory = await this.prisma. vehicleLocationHistory.findFirst({
                where: {
                    vehicleId: vehicleId,
                    valid: true
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: 1
            });

            if (!lastHistory) return 0;

            const lastTimestamp = Math.floor(lastHistory.createdAt.getTime() / 1000);
            const timeDelta = timestamp - lastTimestamp;

            if (timeDelta <= 0) return 0;

            const distance = Math.sqrt(
                Math.pow(x - lastHistory.X, 2) +
                Math.pow(y - lastHistory.Y, 2)
            );

            const speed = Math.round(distance / timeDelta); // m/s

            return speed;
        } catch (error) {
            console.error(`[${vehicleId}] Error calculating speed:`, error);
            return 0;
        }
    }

    /**
     * 更新道路交通状态
     */
    private async updateTrafficStatus(roadId: string) {
        try {
            // 获取该道路的所有节点
            const roadNodes = await this.prisma. mapNode.findMany({
                where: {
                    roadId: roadId,
                    block: 'ROAD'
                }
            });

            if (roadNodes.length === 0) return;

            // 获取道路的边界框
            const minX = Math.min(...roadNodes.map(n => n.x));
            const maxX = Math.max(...roadNodes.map(n => n.x));
            const minY = Math.min(... roadNodes.map(n => n.y));
            const maxY = Math.max(...roadNodes. map(n => n.y));

            // 统计该道路区域内的车辆数量
            const vehicleCount = await this.prisma.vehicle.count({
                where: {
                    currentX: {
                        gte: minX - 10, // 扩展10米容差
                        lte: maxX + 10
                    },
                    currentY: {
                        gte: minY - 10,
                        lte:  maxY + 10
                    },
                    updatedAt: {
                        gte: new Date(Date.now() - 60000) // 只统计最近1分钟内更新的车辆
                    }
                }
            });

            // 根据车辆密度更新交通状态
            let trafficLevel:  'UNKNOWN' | 'SMOOTH' | 'NORMAL' | 'CONGESTED' = 'UNKNOWN';

            const density = vehicleCount / roadNodes.length;

            if (density < 0.1) {
                trafficLevel = 'SMOOTH';
            } else if (density < 0.3) {
                trafficLevel = 'NORMAL';
            } else {
                trafficLevel = 'CONGESTED';
            }

            // 批量更新该道路所有节点的交通状态
            await this.prisma.mapNode.updateMany({
                where: {
                    roadId: roadId,
                    block: 'ROAD'
                },
                data: {
                    traffic: trafficLevel,
                    updatedAt: new Date()
                }
            });

            console.log(`[Traffic] Road ${roadId}:  ${trafficLevel} (${vehicleCount} vehicles, density: ${density.toFixed(2)})`);
        } catch (error) {
            console.error('Error updating traffic status:', error);
        }
    }

    /**
     * 获取车辆当前位置
     */
    async getVehicleCurrentLocation(vehicleId: string) {
        return await this.prisma.vehicle. findUnique({
            where:  { id: vehicleId }
        });
    }

    /**
     * 获取车辆轨迹历史
     */
    async getVehicleTrajectory(
        vehicleId: string,
        startTime?:  Date,
        endTime?: Date,
        limit:  number = 100
    ) {
        return await this.prisma.vehicleLocationHistory.findMany({
            where: {
                vehicleId: vehicleId,
                ...(startTime && endTime ?  {
                    createdAt: {
                        gte: startTime,
                        lte: endTime
                    }
                } : {})
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: limit
        });
    }

    /**
     * 获取指定区域内的所有车辆
     */
    async getVehiclesInArea(
        minX: number,
        maxX: number,
        minY: number,
        maxY:  number
    ) {
        return await this.prisma.vehicle.findMany({
            where: {
                currentX: {
                    gte: minX,
                    lte: maxX
                },
                currentY: {
                    gte: minY,
                    lte: maxY
                }
            }
        });
    }

    /**
     * 清理旧的历史数据
     */
    async cleanOldHistory(daysToKeep: number = 7) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const result = await this.prisma.vehicleLocationHistory.deleteMany({
            where: {
                createdAt: {
                    lt: cutoffDate
                }
            }
        });

        console.log(`Cleaned ${result.count} old location history records`);
        return result;
    }

    /**
     * 手动发布测试消息(用于调试)
     */
    publishTestLocation(vehicleId: string, data:  Partial<ESP32LocationData>) {
        const topic = `vehicle/${vehicleId}/info`;
        const testData:  ESP32LocationData = {
            vehicle_id: vehicleId,
            valid: data.valid !== undefined ? data.valid : true,
            x: data.x || 0,
            y: data.y || 0,
            distance: data.distance || 0,
            angle: data.angle || 0,
            direction:  data.direction || '未知',
            timestamp: data.timestamp || Math.floor(Date.now() / 1000),
            events: data.events || 0
        };

        this. mqttClient.publish(topic, JSON.stringify(testData), (err) => {
            if (err) {
                console.error('Error publishing test message:', err);
            } else {
                console.log(`Published test message to ${topic}`);
            }
        });
    }

    /**
     * 订阅特定车辆的主题
     */
    subscribeToVehicle(vehicleId: string) {
        const topic = `vehicle/${vehicleId}/info`;
        this.mqttClient.subscribe(topic, (err) => {
            if (err) {
                console.error(`Error subscribing to ${topic}: `, err);
            } else {
                console.log(`Subscribed to ${topic}`);
            }
        });
    }

    /**
     * 取消订阅特定车辆的主题
     */
    unsubscribeFromVehicle(vehicleId: string) {
        const topic = `vehicle/${vehicleId}/info`;
        this.mqttClient.unsubscribe(topic, (err) => {
            if (err) {
                console.error(`Error unsubscribing from ${topic}:`, err);
            } else {
                console.log(`Unsubscribed from ${topic}`);
            }
        });
    }

    /**
     * 断开MQTT连接
     */
    disconnect() {
        this.mqttClient.end();
    }
}