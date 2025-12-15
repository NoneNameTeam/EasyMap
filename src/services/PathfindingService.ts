import { PrismaClient } from "@prisma/client";
import axios from "axios";

interface AstarNode {
    x: number;
    y: number;
}

interface AstarEdge {
    u: number;  // 1-based index
    v: number;  // 1-based index
    w: number;  // weight
}

interface AstarRequest {
    n: number;
    start: number;
    target: number;
    coords: AstarNode[];
    edges: AstarEdge[];
}

interface AstarResponse {
    status: 'success' | 'failed' | 'error';
    message?:  string;
    path?: number[];  // 1-based indices
    distance?: number;
}

interface KeyPointData {
    id: string;
    roadId: string;
    name: string;
    x: number;
    y: number;
    type: string;
    connectedTo:  string[];
    road: {
        id: string;
        name: string;
    };
}

interface PathfindingOptions {
    considerTraffic?: boolean;  // 考虑交通拥堵
    avoidEvents?: boolean;      // 避开事件路段
    preferredSpeed?: number;    // 期望速度
    maxDetour?: number;         // 最大绕行距离(可选)
}

export class PathfindingService {
    private prisma: PrismaClient;
    private astarServiceUrl: string;

    constructor(prisma: PrismaClient, astarServiceUrl:  string = 'http://localhost:8080') {
        this.prisma = prisma;
        this.astarServiceUrl = astarServiceUrl;
    }

    /**
     * 基于关键点计算路径
     */
    async findPath(
        startX: number,
        startY: number,
        targetX: number,
        targetY: number,
        options: PathfindingOptions = {}
    ): Promise<{
        success: boolean;
        path?: Array<{
            keyPointId: string;
            keyPointName: string;
            x: number;
            y: number;
            type: string;
            roadId: string;
            roadName: string;
        }>;
        distance?: number;
        estimatedTime?: number;
        roads?: Array<{ id: string; name: string }>;
        message?: string;
    }> {
        try {
            // 1. 获取所有关键点及其连接关系
            const keyPoints = await this.getAllKeyPoints();

            if (keyPoints.length === 0) {
                return {
                    success: false,
                    message: 'No road network (KeyPoints) available'
                };
            }

            // 2. 找到距离起点和终点最近的关键点
            const startKeyPoint = this.findNearestKeyPoint(startX, startY, keyPoints);
            const targetKeyPoint = this.findNearestKeyPoint(targetX, targetY, keyPoints);

            if (! startKeyPoint || !targetKeyPoint) {
                return {
                    success: false,
                    message: 'Cannot find nearest key points for start or target position'
                };
            }

            console.log(`Start KeyPoint: ${startKeyPoint. name} (${startKeyPoint.id})`);
            console.log(`Target KeyPoint: ${targetKeyPoint.name} (${targetKeyPoint.id})`);

            // 3. 构建图数据(节点索引映射)
            const graphData = await this.buildKeyPointGraph(keyPoints, options);

            // 4. 获取起点和终点在图中的索引
            const startIdx = graphData.keyPointIndexMap. get(startKeyPoint.id);
            const targetIdx = graphData.keyPointIndexMap.get(targetKeyPoint.id);

            if (startIdx === undefined || targetIdx === undefined) {
                return {
                    success: false,
                    message: 'Start or target key point not found in graph'
                };
            }

            // 5. 构建 A* 请求
            const astarRequest: AstarRequest = {
                n: keyPoints.length,
                start: startIdx + 1,  // 转为 1-based
                target:  targetIdx + 1,
                coords: keyPoints.map(kp => ({ x: kp.x, y: kp.y })),
                edges: graphData.edges
            };

            // 6. 调用 A* 服务
            const astarResponse = await this.callAstarService(astarRequest);

            if (astarResponse.status !== 'success' || !astarResponse.path) {
                return {
                    success: false,
                    message: astarResponse.message || 'No path found between key points'
                };
            }

            // 7. 转换结果: 将索引转为关键点信息
            const path = astarResponse.path. map(idx => {
                const kp = keyPoints[idx - 1];  // 转回 0-based
                return {
                    keyPointId: kp. id,
                    keyPointName: kp.name,
                    x: kp.x,
                    y: kp. y,
                    type: kp.type,
                    roadId: kp.roadId,
                    roadName: kp.road. name
                };
            });

            // 8. 提取经过的道路列表
            const roads = this.extractUniqueRoads(path);

            // 9. 计算预估时间
            const estimatedTime = this.calculateEstimatedTime(
                astarResponse.distance || 0,
                options.preferredSpeed || 50
            );

            return {
                success: true,
                path,
                distance: astarResponse. distance,
                estimatedTime,
                roads
            };

        } catch (error) {
            console.error('Pathfinding error:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown pathfinding error'
            };
        }
    }

    /**
     * 获取所有关键点
     */
    private async getAllKeyPoints(): Promise<KeyPointData[]> {
        const keyPoints = await this.prisma.keyPoint.findMany({
            include: {
                road: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: { id: 'asc' }
        });

        return keyPoints;
    }

    /**
     * 找到最近的关键点
     */
    private findNearestKeyPoint(
        x: number,
        y: number,
        keyPoints:  KeyPointData[]
    ): KeyPointData | null {
        if (keyPoints. length === 0) return null;

        let minDist = Infinity;
        let nearest: KeyPointData | null = null;

        for (const kp of keyPoints) {
            const dist = Math.hypot(kp.x - x, kp.y - y);
            if (dist < minDist) {
                minDist = dist;
                nearest = kp;
            }
        }

        return nearest;
    }

    /**
     * 构建关键点图(节点和边)
     */
    private async buildKeyPointGraph(
        keyPoints: KeyPointData[],
        options: PathfindingOptions = {}
    ): Promise<{
        keyPointIndexMap: Map<string, number>;  // keyPointId -> index
        edges: AstarEdge[];
    }> {
        // 创建关键点ID到索引的映射
        const keyPointIndexMap = new Map<string, number>();
        keyPoints.forEach((kp, idx) => {
            keyPointIndexMap.set(kp.id, idx);
        });

        const edges: AstarEdge[] = [];

        // 如果需要考虑交通或避开事件,获取路段的交通状态
        let roadTrafficMap: Map<string, { traffic: string; hasEvent: boolean }> | null = null;

        if (options.considerTraffic || options.avoidEvents) {
            roadTrafficMap = await this.getRoadTrafficStatus();
        }

        // 遍历每个关键点,构建边
        for (let i = 0; i < keyPoints.length; i++) {
            const keyPoint = keyPoints[i];

            // 遍历该关键点连接的其他关键点
            for (const connectedId of keyPoint.connectedTo) {
                const targetIdx = keyPointIndexMap.get(connectedId);

                if (targetIdx === undefined) {
                    console. warn(`Connected KeyPoint ${connectedId} not found in graph`);
                    continue;
                }

                // 计算边的权重
                const targetKeyPoint = keyPoints[targetIdx];
                const distance = Math.hypot(
                    targetKeyPoint.x - keyPoint. x,
                    targetKeyPoint.y - keyPoint.y
                );

                let weight = distance;

                // 应用交通状态乘数
                if (options.considerTraffic && roadTrafficMap) {
                    const roadStatus = roadTrafficMap.get(keyPoint.roadId);
                    if (roadStatus) {
                        const trafficMultiplier = this.getTrafficMultiplier(roadStatus.traffic);
                        weight *= trafficMultiplier;

                        // 如果需要避开事件且该路段有事件,大幅增加权重
                        if (options.avoidEvents && roadStatus.hasEvent) {
                            weight *= 10;  // 惩罚有事件的路段
                        }
                    }
                }

                // 添加边(注意: 1-based)
                edges.push({
                    u: i + 1,
                    v: targetIdx + 1,
                    w: weight
                });
            }
        }

        return {
            keyPointIndexMap,
            edges
        };
    }

    /**
     * 获取道路交通状态
     */
    private async getRoadTrafficStatus(): Promise<Map<string, { traffic: string; hasEvent: boolean }>> {
        const roadStatusMap = new Map<string, { traffic: string; hasEvent: boolean }>();

        // 查询所有道路的地图节点,获取交通状态
        const mapNodes = await this.prisma. mapNode.findMany({
            where: {
                block: 'ROAD',
                roadId: { not: null }
            },
            select: {
                roadId: true,
                traffic:  true,
                event: true
            }
        });

        // 按道路分组统计
        const roadGroups = new Map<string, Array<{ traffic: string; event: string | null }>>();

        mapNodes.forEach(node => {
            if (! node.roadId) return;

            if (!roadGroups.has(node.roadId)) {
                roadGroups.set(node.roadId, []);
            }
            roadGroups.get(node.roadId)!.push({
                traffic: node.traffic,
                event: node.event
            });
        });

        // 计算每条道路的整体状态
        roadGroups.forEach((nodes, roadId) => {
            // 统计交通状态
            const trafficCounts = {
                SMOOTH: 0,
                NORMAL: 0,
                CONGESTED: 0,
                UNKNOWN: 0
            };

            let hasEvent = false;

            nodes.forEach(node => {
                const traffic = node.traffic as keyof typeof trafficCounts;
                if (traffic in trafficCounts) {
                    trafficCounts[traffic]++;
                }
                if (node.event) {
                    hasEvent = true;
                }
            });

            // 确定主要交通状态(取最多的)
            let dominantTraffic = 'NORMAL';
            let maxCount = 0;

            Object.entries(trafficCounts).forEach(([traffic, count]) => {
                if (count > maxCount) {
                    maxCount = count;
                    dominantTraffic = traffic;
                }
            });

            roadStatusMap.set(roadId, {
                traffic: dominantTraffic,
                hasEvent
            });
        });

        return roadStatusMap;
    }

    /**
     * 获取交通状态权重乘数
     */
    private getTrafficMultiplier(traffic: string): number {
        switch (traffic) {
            case 'SMOOTH':  return 0.8;
            case 'NORMAL': return 1.0;
            case 'CONGESTED': return 2.5;
            case 'UNKNOWN':
            default: return 1.0;
        }
    }

    /**
     * 调用 A* 服务
     */
    private async callAstarService(request: AstarRequest): Promise<AstarResponse> {
        try {
            console.log(`Calling A* service:  ${this.astarServiceUrl}`);
            console.log(`Graph size: ${request.n} nodes, ${request.edges.length} edges`);

            const response = await axios. post<AstarResponse>(
                this. astarServiceUrl,
                request,
                {
                    headers:  { 'Content-Type': 'application/json' },
                    timeout: 30000
                }
            );

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`A* Service Error: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * 提取经过的道路列表(去重)
     */
    private extractUniqueRoads(
        path: Array<{ roadId: string; roadName: string }>
    ): Array<{ id: string; name: string }> {
        const roadMap = new Map<string, string>();

        path.forEach(node => {
            if (!roadMap.has(node. roadId)) {
                roadMap.set(node.roadId, node.roadName);
            }
        });

        return Array.from(roadMap.entries()).map(([id, name]) => ({ id, name }));
    }

    /**
     * 计算预估时间(秒)
     */
    private calculateEstimatedTime(distance:  number, speed: number): number {
        if (speed <= 0) return 0;
        return Math.round(distance / speed);
    }

    /**
     * 获取推荐路径(避开拥堵和事件)
     */
    async getRecommendedPath(
        startX: number,
        startY: number,
        targetX: number,
        targetY: number
    ) {
        return this.findPath(startX, startY, targetX, targetY, {
            considerTraffic: true,
            avoidEvents: true,
            preferredSpeed: 50
        });
    }

    /**
     * 获取最短路径(仅考虑距离)
     */
    async getShortestPath(
        startX: number,
        startY: number,
        targetX: number,
        targetY:  number
    ) {
        return this.findPath(startX, startY, targetX, targetY, {
            considerTraffic: false,
            avoidEvents: false
        });
    }

    /**
     * 获取指定关键点之间的路径
     */
    async findPathBetweenKeyPoints(
        startKeyPointId: string,
        targetKeyPointId: string,
        options: PathfindingOptions = {}
    ): Promise<{
        success: boolean;
        path?: Array<any>;
        distance?: number;
        message?: string;
    }> {
        try {
            const keyPoints = await this.getAllKeyPoints();

            const startKP = keyPoints.find(kp => kp.id === startKeyPointId);
            const targetKP = keyPoints.find(kp => kp.id === targetKeyPointId);

            if (!startKP || !targetKP) {
                return {
                    success: false,
                    message: 'Start or target key point not found'
                };
            }

            return this.findPath(startKP.x, startKP.y, targetKP.x, targetKP.y, options);
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}