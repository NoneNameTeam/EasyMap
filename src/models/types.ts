export type BlockCategory = "BUILDING" | "ROAD" | "WATER";
export type TrafficLevel = "UNKNOWN" | "SMOOTH" | "NORMAL" | "CONGESTED";
export type RoadEvent = "ACCIDENT" | "CONSTRUCTION" | "ROAD_CLOSURE";

export interface MapNode {
    id: number;
    x: number;
    y: number;
    block: BlockCategory;
    traffic: TrafficLevel;
    event: RoadEvent | null;
    roadId: string | null;
    updatedAt: string;
    CreatedAt: string;
}
