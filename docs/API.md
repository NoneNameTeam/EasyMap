# API文档

## 基础URL
`http://localhost:3000/` (默认)

## 接口端点

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
    "centerLines": [...],
    "keyPoints": [...],
    "lanes": [...]
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
  "centerLines": [...],
  "keyPoints": [...],
  "lanes": [...]
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
      "centerLines": [...],
      "keyPoints": [...],
      "lanes": [...]
    }
  ]
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