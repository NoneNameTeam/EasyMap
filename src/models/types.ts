export type BlockCategory = "BUILDING" | "ROAD" | "WATER";
export type TrafficLevel = "UNKNOWN" | "SMOOTH" | "NORMAL" | "CONGESTED";
export type RoadEvent = "ACCIDENT" | "CONSTRUCTION" | "ROAD_CLOSURE";

export interface MapNode {
    id: string;
    x: number;
    y: number;
    block: BlockCategory;
    traffic: TrafficLevel;
    event: RoadEvent | null;
    roadId: string | null;
    updatedAt: Date;
    createdAt: Date;
}

export interface ObjectList {
    id: string;
    name: string;
    type: BlockCategory;
    nodes: MapNode[];
}