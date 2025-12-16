# API文档

## 目录
- [RESTful API](#restful-api)
- [MQTT API](#mqtt-api)

## RESTful API

### 基础URL
`http://localhost:3000/` (默认)

### 接口端点

### 1. GET /maps/data
使用可选过滤器检索地图数据，支持基于游标的分页。

#### 查询参数
- `block`: 按区块类型过滤 (字符串)
- `roadId`: 按道路ID过滤 (字符串)
- `cursor`: 分页游标，使用上一页的最后一个元素ID (字符串，可选)
- `limit`: 每页返回的数量，默认100 (整数，可选)

#### 响应
```json
{
  "items": [
    {
      "id": 1,
      "x": 10,
      "y": 20,
      "block": "BUILDING",
      "traffic": "UNKNOWN",
      "event": null,
      "roadId": null,
      "updatedAt": "2023-01-01T00:00:00.000Z"
    }
  ],
  "nextCursor": "2",
  "hasNextPage": true
}
```

### 2. POST /maps/data
创建新的地图数据。

#### 请求体
```json
{
  "x": 10,
  "y": 20,
  "block": "ROAD",
  "traffic": "NORMAL",
  "event": null,
  "roadId": "road-1"
}
```

#### 响应
```json
{
  "id": 2,
  "x": 10,
  "y": 20,
  "block": "ROAD",
  "traffic": "NORMAL",
  "event": null,
  "roadId": "road-1",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

### 3. PUT /maps/data/:id
更新现有地图数据。

#### URL参数
- `id`: 地图节点ID (字符串 UUID)

#### 请求体 (部分)
```json
{
  "traffic": "CONGESTED",
  "event": "ACCIDENT"
}
```

#### 响应
```json
{
  "id": 2,
  "x": 10,
  "y": 20,
  "block": "ROAD",
  "traffic": "CONGESTED",
  "event": "ACCIDENT",
  "roadId": "road-1",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

### 4. GET /maps/:x/:y
按坐标检索地图数据。

#### URL参数
- `x`: X坐标 (数字)
- `y`: Y坐标 (数字)

#### 响应
```json
{
  "id": 1,
  "x": 10,
  "y": 20,
  "block": "BUILDING",
  "traffic": "UNKNOWN",
  "event": null,
  "roadId": null,
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

### 5. GET /objects
使用可选过滤器检索对象列表数据，支持基于游标的分页。

#### 查询参数
- `objectId`: 按对象ID过滤 (字符串)
- `roadId`: 按道路ID过滤 (字符串)
- `cursor`: 分页游标，使用上一页的最后一个元素ID (字符串，可选)
- `limit`: 每页返回的数量，默认100 (整数，可选)

#### 响应
```json
{
  "items": [
    {
      "id": "object-1",
      "name": "道路A",
      "type": "ROAD",
      "nodes": [
        { "id": 1 },
        { "id": 2 }
      ]
    }
  ],
  "nextCursor": "object-2",
  "hasNextPage": true
}
```

### 6. PUT /objects
创建新的对象列表。

#### 请求体
```json
{
  "name": "道路A",
  "type": "ROAD",
  "nodes": [
    {
      "x": 10,
      "y": 20,
      "block": "ROAD",
      "traffic": "NORMAL",
      "event": null
    }
  ]
}
```

#### 响应
```json
{
  "id": "object-1",
  "name": "道路A",
  "type": "ROAD",
  "nodes": [
    { "id": 1 },
    { "id": 2 }
  ]
}
```

### 7. POST /objects/:objectId/nodes
向对象添加节点。

#### URL参数
- `objectId`: 对象ID (字符串)

#### 请求体
```json
{
  "nodeId": "1"
}
```

#### 响应
```json
{
  "id": "object-1",
  "name": "道路A",
  "type": "ROAD",
  "nodes": [
    { "id": 1 },
    { "id": 2 },
    { "id": 3 }
  ]
}
```

### 8. GET /health
检查服务器健康状态。

#### 响应
```json
{
  "status": "ok",
  "timestamp": 1234567890
}
```

### 9. POST /roads
创建新的道路配置。

#### 请求体
```json
{
  "name": "道路A",
  "description": "主干道",
  "centerLines": [
    {
      "type": "HORIZONTAL",
      "value": 100,
      "start": 0,
      "end": 200
    }
  ],
  "keyPoints": [
    {
      "name": "起点",
      "x": 0,
      "y": 100,
      "type": "ENDPOINT"
    },
    {
      "name": "终点",
      "x": 200,
      "y": 100,
      "type": "ENDPOINT",
      "connectsTo": ["起点"]
    }
  ]
}
```

#### 响应
```json
{
  "id": "road-1",
  "name": "道路A",
  "description": "主干道",
  "centerLines": [
    {
      "id": "centerline-1",
      "roadId": "road-1",
      "type": "HORIZONTAL",
      "fixedAxis": "Y",
      "fixedValue": 100,
      "startValue": 0,
      "endValue": 200
    }
  ],
  "keyPoints": [
    {
      "id": "keypoint-1",
      "roadId": "road-1",
      "name": "起点",
      "x": 0,
      "y": 100,
      "type": "ENDPOINT",
      "connectedTo": ["keypoint-2"]
    },
    {
      "id": "keypoint-2",
      "roadId": "road-1",
      "name": "终点",
      "x": 200,
      "y": 100,
      "type": "ENDPOINT",
      "connectedTo": ["keypoint-1"]
    }
  ],
  "lanes": [
    {
      "id": "lane-1",
      "roadId": "road-1",
      "laneNumber": 1,
      "direction": "FORWARD",
      "startX": 0,
      "startY": 100,
      "endX": 200,
      "endY": 100,
      "width": 8,
      "centerOffset": 4
    },
    {
      "id": "lane-2",
      "roadId": "road-1",
      "laneNumber": 2,
      "direction": "BACKWARD",
      "startX": 0,
      "startY": 100,
      "endX": 200,
      "endY": 100,
      "width": 8,
      "centerOffset": -4
    }
  ]
}
```

### 10. GET /roads
获取所有道路配置。

#### 响应
```json
[
  {
    "id": "road-1",
    "name": "道路A",
    "description": "主干道",
    "centerLines": ["..."],
    "keyPoints": ["..."],
    "lanes": ["..."]
  }
]
```

### 11. GET /roads/:id
获取单条道路详情。

#### URL参数
- `id`: 道路ID (字符串)

#### 响应
```json
{
  "id": "road-1",
  "name": "道路A",
  "description": "主干道",
  "centerLines": ["..."],
  "keyPoints": ["..."],
  "lanes": ["..."]
}
```

### 12. DELETE /roads/:id
删除道路配置。

#### URL参数
- `id`: 道路ID (字符串)

#### 响应
```json
{
  "deleted": true
}
```

### 13. GET /roads/network
获取路网图（用于可视化）。

#### 响应
```json
{
  "nodes": [
    {
      "id": "keypoint-1",
      "name": "起点",
      "position": { "x": 0, "y": 100 },
      "type": "ENDPOINT",
      "roadName": "道路A"
    }
  ],
  "edges": [
    {
      "from": "keypoint-1",
      "to": "keypoint-2"
    }
  ],
  "roads": [
    {
      "id": "road-1",
      "name": "道路A",
      "centerLines": ["..."],
      "keyPoints": ["..."],
      "lanes": ["..."]    }
  ]
}
```

### 14. GET /roads/congestion/overview
获取所有路段的拥堵概览。

#### 查询参数
- `level`: 按交通等级过滤 (字符串，可选)

#### 响应
```json
{
  "totalRoads": 5,
  "overview": [
    {
      "roadId": "road-1",
      "roadName": "道路A",
      "trafficLevel": "CONGESTED",
      "vehicleCount": 15,
      "congestionPercentage": 75,
      "nodeCount": 100
    }
  ],
  "summary": {
    "smooth": 1,
    "normal": 2,
    "congested": 1,
    "unknown": 1
  }
}
```

### 15. GET /roads/:roadId/congestion
获取指定路段的拥堵状态。

#### URL参数
- `roadId`: 道路ID (字符串)

#### 响应
```json
{
  "roadId": "road-1",
  "roadName": "道路A",
  "description": "主干道",
  "vehicleCount": 15,
  "nodeCount": 100,
  "averageSpeed": 30,
  "trafficLevel": "CONGESTED",
  "trafficDistribution": {
    "UNKNOWN": 0,
    "SMOOTH": 20,
    "NORMAL": 10,
    "CONGESTED": 70
  },
  "congestionPercentage": 70,
  "hasEvents": true,
  "lastUpdated": "2023-01-01T00:00:00.000Z",
  "nodes": [
    {
      "id": 1,
      "x": 10,
      "y": 100,
      "traffic": "CONGESTED",
      "event": null,
      "updatedAt": "2023-01-01T00:00:00.000Z"
    }
  ]
}
```

### 16. GET /roads/:roadId/congestion/history
获取路段历史拥堵趋势。

#### URL参数
- `roadId`: 道路ID (字符串)

#### 查询参数
- `hours`: 查询小时数，默认24小时 (整数，可选)

#### 响应
```json
{
  "roadId": "road-1",
  "period": {
    "hours": 24,
    "start": "2023-01-01T00:00:00.000Z",
    "end": "2023-01-02T00:00:00.000Z"
  },
  "history": [
    {
      "time": "2023-01-01T00:00:00.000Z",
      "vehicleCount": 5
    },
    {
      "time": "2023-01-01T01:00:00.000Z",
      "vehicleCount": 8
    }
  ]
}
```

### 17. POST /pathfinding/route
计算最优路径。

#### 请求体
```json
{
  "startX": 100,
  "startY": 200,
  "targetX": 300,
  "targetY": 400,
  "considerTraffic": true,
  "avoidEvents": true,
  "preferredSpeed": 50
}
```

#### 响应
```json
{
  "path": [
    {
      "keyPointId": "keypoint-1",
      "keyPointName": "起点",
      "x": 100,
      "y": 200,
      "type": "ENDPOINT",
      "roadId": "road-1",
      "roadName": "道路A"
    },
    {
      "keyPointId": "keypoint-2",
      "keyPointName": "终点",
      "x": 300,
      "y": 400,
      "type": "ENDPOINT",
      "roadId": "road-1",
      "roadName": "道路A"
    }
  ],
  "distance": 282.84,
  "estimatedTime": 5.66,
  "roads": [
    {
      "id": "road-1",
      "name": "道路A"
    }
  ],
  "keyPointCount": 2,
  "options": {
    "considerTraffic": true,
    "avoidEvents": true,
    "preferredSpeed": 50
  }
}
```

### 18. POST /pathfinding/recommended
获取推荐路径。

#### 请求体
```json
{
  "startX": 100,
  "startY": 200,
  "targetX": 300,
  "targetY": 400
}
```

#### 响应
```json
{
  "path": ["..."],
  "distance": 282.84,
  "estimatedTime": 5.66,
  "roads": ["..."],
  "routeType": "recommended"
}
```

### 19. POST /pathfinding/shortest
获取最短路径。

#### 请求体
```json
{
  "startX": 100,
  "startY": 200,
  "targetX": 300,
  "targetY": 400
}
```

#### 响应
```json
{
  "path": ["..."],
  "distance": 282.84,
  "estimatedTime": 5.66,
  "roads": ["..."],
  "routeType": "shortest"
}
```

### 20. POST /pathfinding/keypoints
基于关键点ID进行路径规划。

#### 请求体
```json
{
  "startKeyPointId": "keypoint-1",
  "targetKeyPointId": "keypoint-2",
  "considerTraffic": true,
  "avoidEvents": true,
  "preferredSpeed": 50
}
```

#### 响应
```json
{
  "success": true,
  "path": ["..."],
  "distance": 282.84,
  "estimatedTime": 5.66,
  "roads": ["..."]
}
```

### 21. POST /pathfinding/batch
批量路径规划。

#### 请求体
```json
{
  "routes": [
    {
      "startX": 100,
      "startY": 200,
      "targetX": 300,
      "targetY": 400,
      "options": {
        "considerTraffic": true,
        "avoidEvents": true
      }
    },
    {
      "startX": 200,
      "startY": 300,
      "targetX": 400,
      "targetY": 500
    }
  ]
}
```

#### 响应
```json
{
  "total": 2,
  "successful": 2,
  "failed": 0,
  "results": [
    {
      "input": {
        "startX": 100,
        "startY": 200,
        "targetX": 300,
        "targetY": 400
      },
      "result": {
        "success": true,
        "path": ["..."],
        "distance": 282.84,
        "estimatedTime": 5.66
      }
    },
    {
      "input": {
        "startX": 200,
        "startY": 300,
        "targetX": 400,
        "targetY": 500
      },
      "result": {
        "success": true,
        "path": ["..."],
        "distance": 282.84,
        "estimatedTime": 5.66
      }
    }
  ]
}
```

### 22. GET /vehicles
获取所有车辆当前位置，支持基于游标的分页。

#### 查询参数
- `type`: 按车辆类型过滤 (字符串，可选)
- `limit`: 每页返回的数量，默认100 (整数，可选)
- `cursor`: 分页游标，使用上一页的最后一个元素ID (字符串，可选)

#### 响应
```json
{
  "items": [
    {
      "id": "vehicle-1",
      "type": "CAR",
      "currentX": 100,
      "currentY": 200,
      "speed": 50,
      "direction": "EAST",
      "distance": 1500,
      "angle": 90,
      "createdAt": "2023-01-01T00:00:00.000Z",
      "updatedAt": "2023-01-01T00:00:00.000Z"
    }
  ],
  "nextCursor": "vehicle-2",
  "hasNextPage": true
}
```

### 23. POST /vehicles
注册新车辆。

#### 请求体
```json
{
  "type": "CAR",
  "currentX": 100,
  "currentY": 200,
  "speed": 50,
  "direction": "EAST",
  "distance": 1500,
  "angle": 90
}
```

#### 响应
```json
{
  "id": "vehicle-1",
  "type": "CAR",
  "currentX": 100,
  "currentY": 200,
  "speed": 50,
  "direction": "EAST",
  "distance": 1500,
  "angle": 90,
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

### 24. GET /vehicles/stats
获取车辆统计信息。

#### 响应
```json
{
  "totalVehicles": 10,
  "vehiclesByType": [
    {
      "type": "CAR",
      "_count": {
        "id": 7
      }
    },
    {
      "type": "TRUCK",
      "_count": {
        "id": 3
      }
    }
  ],
  "recentActivity": 5
}
```

### 25. GET /vehicles/:vehicleId
获取单个车辆当前位置。

#### URL参数
- `vehicleId`: 车辆ID (字符串)

#### 响应
```json
{
  "id": "vehicle-1",
  "type": "CAR",
  "currentX": 100,
  "currentY": 200,
  "speed": 50,
  "direction": "EAST",
  "distance": 1500,
  "angle": 90,
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

### 26. GET /vehicles/:vehicleId/trajectory
获取车辆轨迹历史。

#### URL参数
- `vehicleId`: 车辆ID (字符串)

#### 查询参数
- `startTime`: 开始时间戳 (字符串，可选)
- `endTime`: 结束时间戳 (字符串，可选)
- `limit`: 返回记录数量，默认100 (整数，可选)

#### 响应
```json
[
  {
    "id": 1,
    "vehicleId": "vehicle-1",
    "X": 100,
    "Y": 200,
    "type": "CAR",
    "direction": "EAST",
    "distance": 1500,
    "angle": 90,
    "valid": true,
    "events": 0,
    "rssi": -50,
    "createdAt": "2023-01-01T00:00:00.000Z"
  }
]
```

### 27. GET /vehicles/:vehicleId/history/valid
获取车辆最近的有效位置历史。

#### URL参数
- `vehicleId`: 车辆ID (字符串)

#### 查询参数
- `limit`: 返回记录数量，默认50 (整数，可选)

#### 响应
```json
[
  {
    "id": 1,
    "vehicleId": "vehicle-1",
    "X": 100,
    "Y": 200,
    "type": "CAR",
    "direction": "EAST",
    "distance": 1500,
    "angle": 90,
    "valid": true,
    "events": 0,
    "rssi": -50,
    "createdAt": "2023-01-01T00:00:00.000Z"
  }
]
```

### 28. DELETE /vehicles/:vehicleId
删除车辆及其历史数据。

#### URL参数
- `vehicleId`: 车辆ID (字符串)

#### 响应
```json
{
  "deleted": true,
  "message": "Vehicle deleted successfully"
}
```

### 29. GET /vehicles/area/search
获取指定区域内的车辆。

#### 查询参数
- `minX`: 最小X坐标 (数字，必填)
- `maxX`: 最大X坐标 (数字，必填)
- `minY`: 最小Y坐标 (数字，必填)
- `maxY`: 最大Y坐标 (数字，必填)

#### 响应
```json
[
  {
    "id": "vehicle-1",
    "type": "CAR",
    "currentX": 100,
    "currentY": 200,
    "speed": 50,
    "direction": "EAST",
    "distance": 1500,
    "angle": 90,
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  }
]
```

### 30. DELETE /vehicles/history/clean
清理旧的历史数据。

#### 查询参数
- `days`: 保留天数，默认7天 (整数，可选)

#### 响应
```json
{
  "deleted": 100,
  "cutoffDate": "2023-01-01T00:00:00.000Z",
  "message": "Cleaned 100 old records"
}
```

### 31. GET /traffic-lights
获取所有交通灯配置。

#### 查询参数
- `roadId`: 按道路ID过滤 (字符串，可选)

#### 响应
```json
[
  {
    "id": "light-1",
    "name": "交通灯1",
    "x": 100,
    "y": 200,
    "roadId": "road-1",
    "state": "RED",
    "duration": 30,
    "lastChanged": "2023-01-01T00:00:00.000Z",
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  }
]
```

### 32. GET /traffic-lights/:id
获取单个交通灯详情。

#### URL参数
- `id`: 交通灯ID (字符串)

#### 响应
```json
{
  "id": "light-1",
  "name": "交通灯1",
  "x": 100,
  "y": 200,
  "roadId": "road-1",
  "state": "RED",
  "duration": 30,
  "lastChanged": "2023-01-01T00:00:00.000Z",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

### 33. POST /traffic-lights
创建新的交通灯配置。

#### 请求体
```json
{
  "name": "交通灯1",
  "x": 100,
  "y": 200,
  "roadId": "road-1",
  "duration": 30
}
```

#### 响应
```json
{
  "id": "light-1",
  "name": "交通灯1",
  "x": 100,
  "y": 200,
  "roadId": "road-1",
  "state": "RED",
  "duration": 30,
  "lastChanged": "2023-01-01T00:00:00.000Z",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

### 34. PUT /traffic-lights/:id/state
更新交通灯状态。

#### URL参数
- `id`: 交通灯ID (字符串)

#### 请求体
```json
{
  "state": "GREEN",
  "duration": 45
}
```

#### 响应
```json
{
  "id": "light-1",
  "name": "交通灯1",
  "x": 100,
  "y": 200,
  "roadId": "road-1",
  "state": "GREEN",
  "duration": 45,
  "lastChanged": "2023-01-01T00:00:00.000Z",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

### 35. DELETE /traffic-lights/:id
删除交通灯配置。

#### URL参数
- `id`: 交通灯ID (字符串)

#### 响应
```json
{
  "deleted": true,
  "message": "Traffic light deleted successfully"
}
```

### 36. POST /traffic-lights/batch
批量更新交通灯状态。

#### 请求体
```json
{
  "updates": [
    {
      "id": "light-1",
      "state": "GREEN",
      "duration": 30
    },
    {
      "id": "light-2",
      "state": "RED",
      "duration": 30
    }
  ]
}
```

#### 响应
```json
[
  {
    "id": "light-1",
    "name": "交通灯1",
    "x": 100,
    "y": 200,
    "roadId": "road-1",
    "state": "GREEN",
    "duration": 30,
    "lastChanged": "2023-01-01T00:00:00.000Z",
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  },
  {
    "id": "light-2",
    "name": "交通灯2",
    "x": 150,
    "y": 250,
    "roadId": "road-2",
    "state": "RED",
    "duration": 30,
    "lastChanged": "2023-01-01T00:00:00.000Z",
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  }
]
```

### 37. GET /parking-gates
获取所有停车场闸机配置。

#### 查询参数
- `parkingLotId`: 按停车场ID过滤 (字符串，可选)

#### 响应
```json
[
  {
    "id": "gate-1",
    "name": "停车场入口闸机",
    "x": 100,
    "y": 200,
    "parkingLotId": "lot-1",
    "state": "CLOSED",
    "lastOpened": "2023-01-01T00:00:00.000Z",
    "lastClosed": "2023-01-01T00:00:00.000Z",
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  }
]
```

### 38. GET /parking-gates/:id
获取单个停车场闸机详情。

#### URL参数
- `id`: 闸机ID (字符串)

#### 响应
```json
{
  "id": "gate-1",
  "name": "停车场入口闸机",
  "x": 100,
  "y": 200,
  "parkingLotId": "lot-1",
  "state": "CLOSED",
  "lastOpened": "2023-01-01T00:00:00.000Z",
  "lastClosed": "2023-01-01T00:00:00.000Z",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

### 39. POST /parking-gates
创建新的停车场闸机配置。

#### 请求体
```json
{
  "name": "停车场入口闸机",
  "x": 100,
  "y": 200,
  "parkingLotId": "lot-1"
}
```

#### 响应
```json
{
  "id": "gate-1",
  "name": "停车场入口闸机",
  "x": 100,
  "y": 200,
  "parkingLotId": "lot-1",
  "state": "CLOSED",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

### 40. POST /parking-gates/:id/control
控制停车场闸机开关。

#### URL参数
- `id`: 闸机ID (字符串)

#### 请求体
```json
{
  "action": "OPEN"
}
```

#### 响应
```json
{
  "id": "gate-1",
  "name": "停车场入口闸机",
  "x": 100,
  "y": 200,
  "parkingLotId": "lot-1",
  "state": "OPENING",
  "lastOpened": "2023-01-01T00:00:00.000Z",
  "lastClosed": "2023-01-01T00:00:00.000Z",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

### 41. PUT /parking-gates/:id/status
更新停车场闸机状态（用于接收硬件设备状态反馈）。

#### URL参数
- `id`: 闸机ID (字符串)

#### 请求体
```json
{
  "state": "OPEN"
}
```

#### 响应
```json
{
  "id": "gate-1",
  "name": "停车场入口闸机",
  "x": 100,
  "y": 200,
  "parkingLotId": "lot-1",
  "state": "OPEN",
  "lastOpened": "2023-01-01T00:00:00.000Z",
  "lastClosed": "2023-01-01T00:00:00.000Z",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

### 42. DELETE /parking-gates/:id
删除停车场闸机配置。

#### URL参数
- `id`: 闸机ID (字符串)

#### 响应
```json
{
  "deleted": true,
  "message": "Parking gate deleted successfully"
}
```

## 数据类型

### BlockCategory（区块类别）
- `BUILDING` - 建筑物
- `ROAD` - 道路
- `WATER` - 水域

### TrafficLevel（交通等级）
- `UNKNOWN` - 未知
- `SMOOTH` - 畅通
- `NORMAL` - 正常
- `CONGESTED` - 拥堵

### RoadEvent（道路事件）
- `ACCIDENT` - 事故
- `CONSTRUCTION` - 施工
- `ROAD_CLOSURE` - 道路封闭

### CenterLineType（中心线类型）
- `HORIZONTAL` - 水平
- `VERTICAL` - 垂直

### KeyPointType（关键点类型）
- `ENDPOINT` - 端点
- `INTERSECTION` - 交叉点
- `T_JUNCTION` - T型路口
- `CORNER` - 拐角
- `ENTRANCE` - 入口

### LaneDirection（车道方向）
- `FORWARD` - 正向
- `BACKWARD` - 反向

### TrafficLightState（交通灯状态）
- `RED` - 红灯
- `YELLOW` - 黄灯
- `GREEN` - 绿灯

### ParkingGateState（停车场闸机状态）
- `OPEN` - 开启
- `CLOSED` - 关闭
- `OPENING` - 正在开启
- `CLOSING` - 正在关闭

### ParkingGateAction（停车场闸机动作）
- `OPEN` - 开启
- `CLOSE` - 关闭

## MQTT API

### 概述
MQTT API用于实时传输车辆位置数据，支持低延迟的位置更新和实时监控。

### 连接信息
- 默认MQTT服务器地址：`mqtt://localhost:1883`
- 可以通过环境变量`MQTT_BROKER`自定义MQTT服务器地址

### 主题格式

#### 车辆位置主题
```
vehicle/{vehicleId}/info
```

**参数说明：**
- `vehicleId`: 车辆唯一标识符，例如 `esp32_001` 或 `vehicle-123`

#### 示例主题
```
vehicle/esp32_001/info
vehicle/truck-456/info
```

#### 交通灯主题

##### 交通灯控制主题（订阅）
```
traffic/light/{lightId}/control
```

**参数说明：**
- `lightId`: 交通灯唯一标识符，例如 `light-1` 或 `tl_001`

##### 交通灯状态主题（发布）
```
traffic/light/{lightId}/state
```

**参数说明：**
- `lightId`: 交通灯唯一标识符

#### 停车场闸机主题

##### 闸机控制主题（订阅）
```
parking/gate/{gateId}/control
```

**参数说明：**
- `gateId`: 闸机唯一标识符，例如 `gate-1` 或 `pg_001`

##### 闸机状态反馈主题（订阅）
```
parking/gate/{gateId}/status
```

**参数说明：**
- `gateId`: 闸机唯一标识符

##### 闸机控制指令主题（发布）
```
parking/gate/{gateId}/command
```

**参数说明：**
- `gateId`: 闸机唯一标识符

### 消息格式

#### 车辆位置消息
```json
{
  "vehicle_id": "esp32_001",
  "type": "CAR",
  "valid": true,
  "x": 100.5,
  "y": 200.8,
  "distance": 1500,
  "angle": 90,
  "direction": "EAST",
  "error": 5,
  "timestamp": 1672531200,
  "events": 0,
  "rssi": -50
}
```

**字段说明：**
- `vehicle_id`: 车辆唯一标识符
- `type`: 车辆类型（如 `CAR`, `TRUCK`, `BUS` 等）
- `valid`: 数据有效性标记（`true`/`false`）
- `x`: X坐标
- `y`: Y坐标
- `distance`: 累计行驶距离（米）
- `angle`: 车辆角度（度）
- `direction`: 行驶方向（如 `EAST`, `WEST`, `NORTH`, `SOUTH`, `UNKNOWN` 等）
- `error`: 定位误差（米）
- `timestamp`: Unix时间戳（秒）
- `events`: 事件标记（如 0=无事件, 1=左转, 2=右转等）
- `rssi`: 信号强度（dBm）

#### 交通灯消息

##### 交通灯控制消息
```json
{
  "light_id": "light-1",
  "state": "GREEN",
  "duration": 45,
  "timestamp": 1672531200
}
```

**字段说明：**
- `light_id`: 交通灯唯一标识符
- `state`: 交通灯状态（`RED`, `YELLOW`, `GREEN`）
- `duration`: 状态持续时间（秒）
- `timestamp`: Unix时间戳（秒）

##### 交通灯状态消息
```json
{
  "light_id": "light-1",
  "state": "GREEN",
  "duration": 30,
  "timestamp": 1672531200
}
```

**字段说明：**
- `light_id`: 交通灯唯一标识符
- `state`: 交通灯状态（`RED`, `YELLOW`, `GREEN`）
- `duration`: 状态持续时间（秒）
- `timestamp`: Unix时间戳（秒）

#### 停车场闸机消息

##### 闸机控制消息
```json
{
  "gate_id": "gate-1",
  "action": "OPEN",
  "vehicle_id": "vehicle-123",
  "timestamp": 1672531200
}
```

**字段说明：**
- `gate_id`: 闸机唯一标识符
- `action`: 控制动作（`OPEN`, `CLOSE`）
- `vehicle_id`: 车辆ID（可选）
- `timestamp`: Unix时间戳（秒）

##### 闸机状态反馈消息
```json
{
  "gate_id": "gate-1",
  "state": "OPEN",
  "timestamp": 1672531200
}
```

**字段说明：**
- `gate_id`: 闸机唯一标识符
- `state`: 闸机状态（`OPEN`, `CLOSED`, `OPENING`, `CLOSING`）
- `timestamp`: Unix时间戳（秒）

##### 闸机控制指令消息
```json
{
  "gate_id": "gate-1",
  "action": "OPEN",
  "vehicle_id": "vehicle-123",
  "timestamp": 1672531200
}
```

**字段说明：**
- `gate_id`: 闸机唯一标识符
- `action`: 控制动作（`OPEN`, `CLOSE`）
- `vehicle_id`: 车辆ID（可选）
- `timestamp`: Unix时间戳（秒）

### MQTT服务功能

#### 数据处理流程

##### 车辆位置数据处理
1. **接收消息**: 服务器订阅 `vehicle/+/info` 主题，接收所有车辆的位置消息
2. **数据过滤**: 对位置数据进行去噪和有效性检查
3. **地图匹配**: 将车辆位置匹配到地图上的道路
4. **存储历史**: 保存位置数据到数据库
5. **更新状态**: 更新车辆当前位置和交通状态

##### 交通灯数据处理
1. **接收控制消息**: 服务器订阅 `traffic/light/+/control` 主题
2. **更新状态**: 根据接收到的消息更新交通灯状态到数据库
3. **发布状态**: 通过 `traffic/light/{lightId}/state` 主题发布最新状态

##### 停车场闸机数据处理
1. **接收控制消息**: 服务器订阅 `parking/gate/+/control` 主题
2. **接收状态反馈**: 服务器订阅 `parking/gate/+/status` 主题接收硬件状态反馈
3. **更新数据库**: 根据消息更新闸机状态到数据库
4. **发布指令**: 通过 `parking/gate/{gateId}/command` 主题向硬件发布控制指令

#### 数据有效性检查

##### 车辆位置数据
- 检查 `valid` 标记是否为 `true`
- 过滤坐标为 (0, 0) 的无效数据
- 检查 RSSI 信号强度（小于 -80 dBm 视为无效）
- 检查定位误差（大于 10 米视为无效）

##### 交通灯数据
- 检查交通灯ID是否存在
- 验证状态值是否为有效的交通灯状态（`RED`, `YELLOW`, `GREEN`）
- 验证持续时间是否为正数

##### 停车场闸机数据
- 检查闸机ID是否存在
- 验证动作值是否为有效的闸机动作（`OPEN`, `CLOSE`）
- 验证状态值是否为有效的闸机状态（`OPEN`, `CLOSED`, `OPENING`, `CLOSING`）

#### 交通状态更新
- 根据道路上的车辆密度自动更新交通状态
- 交通状态分为：
  - `UNKNOWN` - 未知
  - `SMOOTH` - 畅通（车辆密度 < 0.1）
  - `NORMAL` - 正常（车辆密度 0.1-0.3）
  - `CONGESTED` - 拥堵（车辆密度 > 0.3）

#### 交通灯控制功能
- 支持实时控制交通灯状态
- 支持设置状态持续时间
- 自动记录状态变更时间

#### 停车场闸机控制功能
- 支持远程控制闸机开关
- 支持接收硬件状态反馈
- 记录开关时间
- 支持关联车辆ID

### MQTT客户端示例

#### Node.js示例
```javascript
const mqtt = require('mqtt');

// 连接到MQTT服务器
const client = mqtt.connect('mqtt://localhost:1883');

// 发布车辆位置数据
function publishVehicleLocation(vehicleId, position) {
  const topic = `vehicle/${vehicleId}/info`;
  const message = JSON.stringify({
    vehicle_id: vehicleId,
    type: "CAR",
    valid: true,
    x: position.x,
    y: position.y,
    distance: 1500,
    angle: 90,
    direction: "EAST",
    error: 5,
    timestamp: Math.floor(Date.now() / 1000),
    events: 0,
    rssi: -50
  });
  
  client.publish(topic, message, (err) => {
    if (err) {
      console.error('发布失败:', err);
    } else {
      console.log('发布成功:', topic);
    }
  });
}

// 示例用法
client.on('connect', () => {
  console.log('已连接到MQTT服务器');
  
  // 每10秒发布一次位置数据
  setInterval(() => {
    publishVehicleLocation('esp32_001', { x: 100.5, y: 200.8 });
  }, 10000);
});
```

### 健康检查
MQTT服务状态可以通过RESTful API的健康检查端点查看：

```
GET /health
```

**响应示例：**
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "mqtt": {
    "broker": "mqtt://localhost:1883",
    "topic": "vehicle/+/info"
  }
}
```