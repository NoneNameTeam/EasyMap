export interface VehicleLocation {
    vehicle_id: string;
    type: string;
    valid: boolean;
    x: number;
    y: number;
    distance: number;
    angle: number;
    direction: string;
    error:  number;
    timestamp: number;
    events: number;
    rssi: number;
}

export class LocationFilter {
    // 存储每个车辆的历史位置
    private vehicleHistory: Map<string, VehicleLocation[]> = new Map();
    private readonly HISTORY_SIZE = 10; // 保留最近10个位置

    isValidData(data: VehicleLocation): boolean {
        // 检查valid标记
        if (!data.valid) return false;

        // 检查坐标是否为0(无效数据)
        if (data.x === 0 && data.y === 0) return false;

        // 检查RSSI信号强度(信号太弱可能导致位置不准)
        if (data.rssi < -100) return false;


        return true;
    }

    /**
     * 卡尔曼滤波
     */
    kalmanFilter(data: VehicleLocation): { x: number; y: number } {
        const history = this.vehicleHistory.get(data.vehicle_id) || [];

        if (history.length === 0) {
            return { x: data.x, y: data.y };
        }

        // 简化的卡尔曼滤波
        const lastPos = history[history.length - 1];
        const Q = 0.1; // 过程噪声
        const R = 1.0; // 测量噪声(根据RSSI调整)
        const K = Q / (Q + R);

        const filteredX = lastPos.x + K * (data.x - lastPos.x);
        const filteredY = lastPos.y + K * (data.y - lastPos.y);

        return { x: filteredX, y:  filteredY };
    }

    /**
     * 去除突变点
     */
    velocityCheck(data: VehicleLocation, filtered: { x: number; y: number }): boolean {
        const history = this.vehicleHistory.get(data.vehicle_id) || [];

        if (history.length === 0) return true;

        const lastPos = history[history.length - 1];
        const timeDelta = (data.timestamp - lastPos.timestamp) / 1000; // 转换为秒

        if (timeDelta <= 0) return false;

        const distance = Math.sqrt(
            Math.pow(filtered.x - lastPos.x, 2) +
            Math.pow(filtered.y - lastPos.y, 2)
        );

        const velocity = distance / timeDelta;
        const MAX_VELOCITY = 10; // 最大速度30 m/s (约108 km/h)

        return velocity <= MAX_VELOCITY;
    }

    /**
     * 移动平均滤波
     */
    movingAverage(vehicleId: string, x: number, y: number): { x: number; y: number } {
        const history = this.vehicleHistory.get(vehicleId) || [];
        const windowSize = Math.min(5, history.length);

        if (windowSize === 0) return { x, y };

        let sumX = x, sumY = y;
        for (let i = 0; i < windowSize; i++) {
            sumX += history[history.length - 1 - i].x;
            sumY += history[history.length - 1 - i].y;
        }

        return {
            x: sumX / (windowSize + 1),
            y: sumY / (windowSize + 1)
        };
    }


    process(data: VehicleLocation): { x: number; y: number } | null {
        if (!this.isValidData(data)) {
            return null;
        }

        let filtered = this.kalmanFilter(data);

        if (!this.velocityCheck(data, filtered)) {
            return null;
        }

        filtered = this.movingAverage(data.vehicle_id, filtered.x, filtered.y);

        this.updateHistory(data);

        return filtered;
    }

    private updateHistory(data: VehicleLocation) {
        const history = this.vehicleHistory.get(data.vehicle_id) || [];
        history.push(data);

        if (history.length > this.HISTORY_SIZE) {
            history.shift();
        }

        this.vehicleHistory.set(data.vehicle_id, history);
    }
}