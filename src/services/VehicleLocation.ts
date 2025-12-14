import mqtt from 'mqtt';
import { PrismaClient } from '@prisma/client';
import { LocationFilter, VehicleLocation } from '../utils/LocationFilter.js';
import { MapMatcher, MatchResult } from '../utils/MapMatcher.js';

export class VehicleLocationService {
    private mqttClient: mqtt.MqttClient;
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
        this.mqttClient.on('connect', () => {
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

                const data:  VehicleLocation = JSON.parse(message.toString());

                // 确保数据中的vehicle_id与主题中的ID一致
                if (! data.vehicle_id) {
                    data.vehicle_id = vehicleId;
                }

                console.log(`Received location update for vehicle ${vehicleId}:`, data);

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
            console.log('MQTT Client offline');
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

    async processVehicleLocation(data:  VehicleLocation) {
        try {
            // 1. 保存原始历史数据
            await this. saveLocationHistory(data);

            // 2. 去噪处理
            const filtered = this.locationFilter.process(data);

            if (! filtered) {
                console.log(`Filtered out invalid location for ${data.vehicle_id}`);
                return;
            }

            // 3. 地图匹配
            const matched = await this.mapMatcher. matchToMap(filtered. x, filtered.y);

            if (!matched || matched.confidence < 0.3) {
                console.log(`Low confidence match for ${data.vehicle_id}, confidence: ${matched?.confidence}`);
                // 即使置信度低也更新车辆位置,但使用过滤后的坐标
                await this.updateVehiclePosition(data. vehicle_id, {
                    x: Math.round(filtered.x),
                    y: Math.round(filtered.y),
                    type: data.type,
                    direction: data.direction,
                    distance: data.distance,
                    angle: data.angle,
                    speed: this.calculateSpeed(data.vehicle_id, filtered.x, filtered.y, data.timestamp)
                });
                return;
            }

            // 4. 更新车辆当前位置
            await this. updateVehiclePosition(data. vehicle_id, {
                x: Math.round(matched.matched. x),
                y: Math.round(matched.matched.y),
                type: data.type,
                direction: data.direction,
                distance: data.distance,
                angle: data.angle,
                speed: this.calculateSpeed(data.vehicle_id, matched.matched.x, matched.matched.y, data.timestamp)
            });

            // 5. 更新道路交通状态
            if (matched.roadId) {
                await this. updateTrafficStatus(matched.roadId);
            }

        } catch (error) {
            console.error('Error in processVehicleLocation:', error);
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
            console.error('Error saving location history:', error);
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
            type:  string;
            direction: string;
            distance: number;
            angle: number;
            speed:  number;
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
                create:  {
                    id: vehicleId,
                    currentX: position. x,
                    currentY: position.y,
                    type: position.type,
                    direction: position.direction,
                    distance: position.distance,
                    angle: position.angle,
                    speed: position.speed
                }
            });
        } catch (error) {
            console.error('Error updating vehicle position:', error);
        }
    }

    /**
     * 计算车辆速度
     */
    private calculateSpeed(vehicleId: string, x: number, y: number, timestamp: number): number {
        //TODO: 实现速度计算逻辑
        return 0;
    }

    /**
     * 更新道路交通状态
     */
    private async updateTrafficStatus(roadId: string) {
        try {
            // 统计该道路上的车辆数量
            const vehicleCount = await this.prisma.vehicle.count({
                where: {
                    // 这里需要根据roadId查询在该路段上的车辆
                    // 由于Vehicle表没有直接关联roadId,需要通过坐标范围查询
                    // 简化处理:  通过MapNode的roadId查询坐标范围
                }
            });

            // 获取该道路的所有节点
            const roadNodes = await this.prisma. mapNode.findMany({
                where: {
                    roadId:  roadId,
                    block: 'ROAD'
                }
            });

            // 根据车辆密度更新交通状态
            let trafficLevel:  'UNKNOWN' | 'SMOOTH' | 'NORMAL' | 'CONGESTED' = 'UNKNOWN';

            if (roadNodes.length > 0) {
                const density = vehicleCount / roadNodes. length;

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
                    data:  {
                        traffic: trafficLevel,
                        updatedAt: new Date()
                    }
                });
            }
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
        return await this.prisma.vehicle. findMany({
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
    publishTestLocation(vehicleId: string, data: VehicleLocation) {
        const topic = `vehicle/${vehicleId}/info`;
        this.mqttClient.publish(topic, JSON.stringify(data), (err) => {
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