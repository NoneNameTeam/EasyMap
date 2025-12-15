import { PrismaClient } from "@prisma/client";

interface MapNode {
    id: string;
    x: number;
    y: number;
    roadId: string | null;
    block: string;
}

interface MatchResult {
    matched: { x:  number; y: number };
    roadId: string | null;
    confidence: number;
    nearestNode?:  MapNode;
}

class MapMatcher {
    constructor(private prisma: PrismaClient) {}

    /**
     * 找到最近的道路节点
     */
    async findNearestRoad(
        x: number,
        y: number,
        searchRadius:  number = 50
    ): Promise<MapNode[]> {
        // 查询附近的道路节点
        const nearbyNodes = await this.prisma.mapNode.findMany({
            where: {
                block: 'ROAD',
                x: {
                    gte: Math.floor(x - searchRadius),
                    lte: Math.floor(x + searchRadius)
                },
                y: {
                    gte: Math.floor(y - searchRadius),
                    lte: Math.floor(y + searchRadius)
                }
            },
            select: {
                id: true,
                x: true,
                y: true,
                roadId: true,
                block:  true
            },
            take: 10
        });

        // 计算实际距离并排序
        const nodesWithDistance = nearbyNodes.map(node => ({
            ...node,
            distance: Math.sqrt(
                Math.pow(node.x - x, 2) + Math.pow(node.y - y, 2)
            )
        }));

        // 按距离排序
        nodesWithDistance.sort((a, b) => a.distance - b.distance);

        return nodesWithDistance.map(({ distance, ...node }) => node);
    }

    /**
     * 投影到最近的道路线段
     */
    projectToRoadSegment(
        point: { x: number; y:  number },
        segmentStart: { x: number; y: number },
        segmentEnd: { x: number; y: number }
    ): { x: number; y: number; distance: number } {
        const dx = segmentEnd.x - segmentStart.x;
        const dy = segmentEnd.y - segmentStart.y;

        if (dx === 0 && dy === 0) {
            return {
                x: segmentStart.x,
                y: segmentStart.y,
                distance: Math.sqrt(
                    Math.pow(point.x - segmentStart.x, 2) +
                    Math.pow(point.y - segmentStart.y, 2)
                )
            };
        }

        // 计算投影点
        const t = Math.max(0, Math.min(1,
            ((point.x - segmentStart.x) * dx + (point.y - segmentStart.y) * dy) /
            (dx * dx + dy * dy)
        ));

        const projX = segmentStart.x + t * dx;
        const projY = segmentStart.y + t * dy;
        const distance = Math.sqrt(
            Math.pow(point.x - projX, 2) +
            Math.pow(point.y - projY, 2)
        );

        return { x: projX, y: projY, distance };
    }

    /**
     * 获取道路的相邻节点
     */
    async getRoadSegments(roadId: string): Promise<MapNode[]> {
        if (!roadId) return [];

        const segments = await this.prisma.mapNode.findMany({
            where: {
                roadId: roadId,
                block: 'ROAD'
            },
            select: {
                id: true,
                x:  true,
                y: true,
                roadId: true,
                block: true
            },
            orderBy: [
                { x: 'asc' },
                { y:  'asc' }
            ]
        });

        return segments;
    }

    /**
     * 执行地图匹配
     */
    async matchToMap(x: number, y: number): Promise<MatchResult | null> {
        const nearbyRoads = await this.findNearestRoad(x, y);

        if (nearbyRoads.length === 0) {
            return null;
        }

        // 找到最近的道路节点
        const nearest = nearbyRoads[0];
        const distance = Math.sqrt(
            Math.pow(nearest.x - x, 2) + Math.pow(nearest.y - y, 2)
        );

        // 如果距离太远,认为不在道路上
        const MAX_DISTANCE = 20; // 最大偏离距离20米
        if (distance > MAX_DISTANCE) {
            return null;
        }

        // 如果有roadId,尝试投影到道路线段
        let matchedPoint = { x: nearest.x, y: nearest.y };
        let finalDistance = distance;

        if (nearest.roadId) {
            const segments = await this.getRoadSegments(nearest.roadId);

            if (segments.length >= 2) {
                // 找到最佳投影线段
                let bestProjection = null;
                let minDistance = distance;

                for (let i = 0; i < segments.length - 1; i++) {
                    const projection = this.projectToRoadSegment(
                        { x, y },
                        { x: segments[i].x, y: segments[i].y },
                        { x: segments[i + 1].x, y: segments[i + 1].y }
                    );

                    if (projection.distance < minDistance) {
                        minDistance = projection.distance;
                        bestProjection = projection;
                    }
                }

                if (bestProjection && bestProjection.distance < MAX_DISTANCE) {
                    matchedPoint = { x: bestProjection.x, y: bestProjection.y };
                    finalDistance = bestProjection.distance;
                }
            }
        }

        // 计算置信度(距离越近置信度越高)
        const confidence = 1 - (finalDistance / MAX_DISTANCE);

        return {
            matched: matchedPoint,
            roadId:  nearest.roadId,
            confidence: Math.max(0, Math.min(1, confidence)),
            nearestNode: nearest
        };
    }

    /**
     * 批量匹配多个位置点
     */
    async batchMatchToMap(
        points: Array<{ x: number; y:  number }>
    ): Promise<Array<MatchResult | null>> {
        const results = await Promise.all(
            points.map(point => this.matchToMap(point.x, point.y))
        );

        return results;
    }
}

export { MapMatcher, MatchResult, MapNode };