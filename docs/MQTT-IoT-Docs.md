# 红绿灯和停车场大门嵌入式开发MQTT通信文档

## 1. 概述

本文档描述了EasyMap系统中红绿灯和停车场大门设备与后端服务器之间的MQTT通信协议。嵌入式设备可以通过此协议接收控制指令并上报设备状态。

## 2. 系统架构

```
+-------------------+      MQTT      +-------------------+
|                   | <------------> |                   |
|   嵌入式设备      |                |   TrafficControl  |
|  (红绿灯/停车场门) |                |    Service        |
|                   | <------------> |                   |
+-------------------+                +-------------------+
```

- 嵌入式设备：红绿灯控制器、停车场大门控制器
- MQTT Broker：消息中间件，处理设备与服务器之间的通信
- TrafficControl Service：后端服务，负责处理MQTT消息并与数据库交互

## 3. 红绿灯MQTT通信

### 3.1 主题结构

| 主题格式                     | 方向       | 描述                     |
|------------------------------|------------|--------------------------|
| `traffic/light/{id}/control` | 服务器→设备 | 控制红绿灯状态           |
| `traffic/light/{id}/state`   | 设备→服务器 | 上报红绿灯状态           |

### 3.2 消息格式

#### 3.2.1 控制指令 (服务器→设备)

```json
{
  "light_id": "light_123",
  "state": "GREEN",
  "duration": 30,
  "timestamp": 1609459200
}
```

- `light_id`: 红绿灯唯一标识符
- `state`: 灯状态 (RED/YELLOW/GREEN)
- `duration`: 当前状态持续时间(秒)
- `timestamp`: 消息时间戳(UNIX时间)

#### 3.2.2 状态上报 (设备→服务器)

```json
{
  "light_id": "light_123",
  "state": "GREEN",
  "voltage": 12.5,
  "current": 0.8,
  "timestamp": 1609459200
}
```

- `light_id`: 红绿灯唯一标识符
- `state`: 当前灯状态 (RED/YELLOW/GREEN)
- `voltage`: 设备电压(可选)
- `current`: 设备电流(可选)
- `timestamp`: 消息时间戳(UNIX时间)

### 3.3 状态枚举

| 状态  | 描述 |
|-------|------|
| RED   | 红灯 |
| YELLOW | 黄灯 |
| GREEN | 绿灯 |

### 3.4 控制指令示例

```
主题: traffic/light/light_123/control
消息: {"light_id":"light_123","state":"GREEN","duration":30,"timestamp":1609459200}
```

## 4. 停车场大门MQTT通信

### 4.1 主题结构

| 主题格式                     | 方向       | 描述                     |
|------------------------------|------------|--------------------------|
| `parking/gate/{id}/command`  | 服务器→设备 | 控制大门开关指令         |
| `parking/gate/{id}/status`   | 设备→服务器 | 上报大门状态             |

### 4.2 消息格式

#### 4.2.1 控制指令 (服务器→设备)

```json
{
  "gate_id": "gate_456",
  "action": "OPEN",
  "vehicle_id": "car_789",
  "timestamp": 1609459200
}
```

- `gate_id`: 大门唯一标识符
- `action`: 动作指令 (OPEN/CLOSE)
- `vehicle_id`: 车辆ID(可选)
- `timestamp`: 消息时间戳(UNIX时间)

#### 4.2.2 状态上报 (设备→服务器)

```json
{
  "gate_id": "gate_456",
  "state": "OPEN",
  "voltage": 24.2,
  "current": 3.5,
  "timestamp": 1609459200
}
```

- `gate_id`: 大门唯一标识符
- `state`: 当前状态 (OPEN/CLOSED/OPENING/CLOSING/ERROR)
- `voltage`: 设备电压(可选)
- `current`: 设备电流(可选)
- `timestamp`: 消息时间戳(UNIX时间)

### 4.3 状态枚举

| 状态     | 描述     |
|----------|----------|
| OPEN     | 已打开   |
| CLOSED   | 已关闭   |
| OPENING  | 正在打开 |
| CLOSING  | 正在关闭 |
| ERROR    | 错误状态 |

### 4.4 动作枚举

| 动作   | 描述 |
|--------|------|
| OPEN   | 打开 |
| CLOSE  | 关闭 |

### 4.5 控制指令示例

```
主题: parking/gate/gate_456/command
消息: {"gate_id":"gate_456","action":"OPEN","vehicle_id":"car_789","timestamp":1609459200}
```

## 5. 嵌入式设备实现示例

### 5.1 ESP32 MQTT客户端示例 (Arduino)

```cpp
#include <WiFi.h>
#include <PubSubClient.h>

// WiFi配置
const char* ssid = "your_wifi_ssid";
const char* password = "your_wifi_password";

// MQTT配置
const char* mqtt_server = "mqtt_broker_ip";
const int mqtt_port = 1883;
const char* mqtt_client_id = "traffic_light_123";
const char* traffic_light_id = "light_123";

// 主题配置
char control_topic[50];
char state_topic[50];

WiFiClient espClient;
PubSubClient client(espClient);

// 状态变量
String current_state = "RED";
int current_duration = 30;

void setup() {
  // 初始化串口
  Serial.begin(115200);
  delay(1000);
  Serial.println("Initializing...");
  
  // 配置主题
  sprintf(control_topic, "traffic/light/%s/control", traffic_light_id);
  sprintf(state_topic, "traffic/light/%s/state", traffic_light_id);
  
  // 连接WiFi
  setup_wifi();
  
  // 配置MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void setup_wifi() {
  delay(10);
  Serial.print("Connecting to ");
  Serial.println(ssid);
  
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);
  
  // 解析JSON消息
  DynamicJsonDocument doc(200);
  deserializeJson(doc, message);
  
  // 更新状态
  if (doc.containsKey("state")) {
    current_state = doc["state"].as<String>();
    Serial.print("New state: ");
    Serial.println(current_state);
    
    // 控制实际的红绿灯
    control_traffic_light(current_state);
  }
  
  if (doc.containsKey("duration")) {
    current_duration = doc["duration"].as<int>();
    Serial.print("New duration: ");
    Serial.println(current_duration);
  }
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    
    if (client.connect(mqtt_client_id)) {
      Serial.println("connected");
      
      // 订阅控制主题
      client.subscribe(control_topic);
      Serial.print("Subscribed to: ");
      Serial.println(control_topic);
      
      // 上报初始状态
      publish_state();
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void publish_state() {
  DynamicJsonDocument doc(200);
  doc["light_id"] = traffic_light_id;
  doc["state"] = current_state;
  doc["voltage"] = 12.5; // 示例电压值
  doc["current"] = 0.8;  // 示例电流值
  doc["timestamp"] = millis() / 1000;
  
  char jsonBuffer[512];
  serializeJson(doc, jsonBuffer);
  
  client.publish(state_topic, jsonBuffer);
  Serial.print("Published state: ");
  Serial.println(jsonBuffer);
}

void control_traffic_light(String state) {
  // 这里实现实际控制红绿灯的代码
  if (state == "RED") {
    // 点亮红灯
    digitalWrite(RED_PIN, HIGH);
    digitalWrite(YELLOW_PIN, LOW);
    digitalWrite(GREEN_PIN, LOW);
  } else if (state == "YELLOW") {
    // 点亮黄灯
    digitalWrite(RED_PIN, LOW);
    digitalWrite(YELLOW_PIN, HIGH);
    digitalWrite(GREEN_PIN, LOW);
  } else if (state == "GREEN") {
    // 点亮绿灯
    digitalWrite(RED_PIN, LOW);
    digitalWrite(YELLOW_PIN, LOW);
    digitalWrite(GREEN_PIN, HIGH);
  }
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  
  // 每秒上报一次状态
  static unsigned long last_publish = 0;
  if (millis() - last_publish > 1000) {
    publish_state();
    last_publish = millis();
  }
}
```

### 5.2 ESP32停车场大门控制示例

```cpp
#include <WiFi.h>
#include <PubSubClient.h>

// WiFi配置
const char* ssid = "your_wifi_ssid";
const char* password = "your_wifi_password";

// MQTT配置
const char* mqtt_server = "mqtt_broker_ip";
const int mqtt_port = 1883;
const char* mqtt_client_id = "parking_gate_456";
const char* gate_id = "gate_456";

// 主题配置
char command_topic[50];
char status_topic[50];

WiFiClient espClient;
PubSubClient client(espClient);

// 状态变量
String current_state = "CLOSED";

void setup() {
  // 初始化串口
  Serial.begin(115200);
  delay(1000);
  Serial.println("Initializing...");
  
  // 配置主题
  sprintf(command_topic, "parking/gate/%s/command", gate_id);
  sprintf(status_topic, "parking/gate/%s/status", gate_id);
  
  // 连接WiFi
  setup_wifi();
  
  // 配置MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void setup_wifi() {
  delay(10);
  Serial.print("Connecting to ");
  Serial.println(ssid);
  
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);
  
  // 解析JSON消息
  DynamicJsonDocument doc(200);
  deserializeJson(doc, message);
  
  // 执行动作
  if (doc.containsKey("action")) {
    String action = doc["action"].as<String>();
    Serial.print("Action received: ");
    Serial.println(action);
    
    if (action == "OPEN") {
      open_gate();
    } else if (action == "CLOSE") {
      close_gate();
    }
  }
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    
    if (client.connect(mqtt_client_id)) {
      Serial.println("connected");
      
      // 订阅命令主题
      client.subscribe(command_topic);
      Serial.print("Subscribed to: ");
      Serial.println(command_topic);
      
      // 上报初始状态
      publish_status();
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void publish_status() {
  DynamicJsonDocument doc(200);
  doc["gate_id"] = gate_id;
  doc["state"] = current_state;
  doc["voltage"] = 24.2; // 示例电压值
  doc["current"] = 3.5;  // 示例电流值
  doc["timestamp"] = millis() / 1000;
  
  char jsonBuffer[512];
  serializeJson(doc, jsonBuffer);
  
  client.publish(status_topic, jsonBuffer);
  Serial.print("Published status: ");
  Serial.println(jsonBuffer);
}

void open_gate() {
  // 更新状态
  current_state = "OPENING";
  publish_status();
  
  // 这里实现实际控制大门打开的代码
  // 例如控制电机或继电器
  digitalWrite(GATE_OPEN_PIN, HIGH);
  delay(5000); // 假设5秒后完全打开
  digitalWrite(GATE_OPEN_PIN, LOW);
  
  // 更新最终状态
  current_state = "OPEN";
  publish_status();
}

void close_gate() {
  // 更新状态
  current_state = "CLOSING";
  publish_status();
  
  // 这里实现实际控制大门关闭的代码
  digitalWrite(GATE_CLOSE_PIN, HIGH);
  delay(5000); // 假设5秒后完全关闭
  digitalWrite(GATE_CLOSE_PIN, LOW);
  
  // 更新最终状态
  current_state = "CLOSED";
  publish_status();
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  
  // 每秒上报一次状态
  static unsigned long last_publish = 0;
  if (millis() - last_publish > 1000) {
    publish_status();
    last_publish = millis();
  }
}
```

## 6. 注意事项

1. **消息格式验证**：设备和服务器都应该验证收到的消息格式是否正确
2. **重连机制**：设备应该实现MQTT重连机制，确保连接断开后能自动恢复
3. **心跳机制**：定期上报状态，确保服务器知道设备在线状态
4. **错误处理**：设备应该处理各种异常情况，并上报ERROR状态
5. **安全性**：考虑使用MQTT TLS加密和身份认证机制

## 7. 测试建议

1. 使用MQTT客户端工具(如MQTT.fx、Mosquitto)测试消息发布和订阅
2. 模拟设备发送状态消息
3. 模拟服务器发送控制指令
4. 测试设备在网络断开后是否能自动重连
