import mqtt from 'mqtt';
import { PrismaClient } from '@prisma/client';

export class TrafficControlService {
    private mqttClient: mqtt.MqttClient;

    constructor(
        private prisma: PrismaClient,
        mqttBrokerUrl: string
    ) {
        this.mqttClient = mqtt.connect(mqttBrokerUrl);
        this.setupMqttHandlers();
    }

    private setupMqttHandlers() {
        this.mqttClient.on('connect', () => {
            console.log('TrafficControlService connected to MQTT');

            // 订阅红绿灯控制主题
            this.mqttClient.subscribe('traffic/light/+/control');

            // 订阅停车场大门控制主题
            this.mqttClient.subscribe('parking/gate/+/control');

            // 订阅大门状态反馈主题（硬件设备上报）
            this.mqttClient.subscribe('parking/gate/+/status');

            console.log('Subscribed to traffic control topics');
        });

        this.mqttClient.on('message', async (topic, message) => {
            try {
                const data = JSON. parse(message.toString());

                if (topic.startsWith('traffic/light/')) {
                    await this.handleTrafficLightMessage(topic, data);
                } else if (topic.startsWith('parking/gate/')) {
                    if (topic.endsWith('/status')) {
                        await this.handleGateStatusMessage(topic, data);
                    } else if (topic.endsWith('/control')) {
                        await this.handleGateControlMessage(topic, data);
                    }
                }
            } catch (error) {
                console.error('MQTT message handling error:', error);
            }
        });

        this.mqttClient.on('error', (error) => {
            console.error('MQTT connection error:', error);
        });
    }

    private async handleTrafficLightMessage(topic:  string, data: any) {
        const lightId = this.extractIdFromTopic(topic);

        await this.prisma.trafficLight.update({
            where: { id:  lightId },
            data: {
                state: data.state,
                lastChanged: new Date()
            }
        });

        console.log(`Traffic light ${lightId} changed to ${data.state}`);
    }

    private async handleGateStatusMessage(topic: string, data: any) {
        const gateId = this.extractIdFromTopic(topic);

        const updateData:  any = { state: data.state };

        if (data.state === 'OPEN') {
            updateData.lastOpened = new Date();
        } else if (data.state === 'CLOSED') {
            updateData.lastClosed = new Date();
        }

        await this.prisma.parkingGate.update({
            where: { id: gateId },
            data: updateData
        });

        console.log(`Gate ${gateId} status updated:  ${data.state}`);
    }

    private async handleGateControlMessage(topic: string, data: any) {
        const gateId = this.extractIdFromTopic(topic);


    }

    // 发布红绿灯状态
    publishTrafficLightState(lightId: string, state:  string, duration?:  number) {
        const topic = `traffic/light/${lightId}/control`;
        const payload = JSON.stringify({
            light_id: lightId,
            state,
            duration:  duration || 30,
            timestamp: Math.floor(Date.now() / 1000)
        });
        this.mqttClient.publish(topic, payload);
    }

    // 发布大门控制指令
    publishGateControl(gateId: string, action:  string, vehicleId?: string) {
        const topic = `parking/gate/${gateId}/command`;
        const payload = JSON.stringify({
            gate_id:  gateId,
            action,
            vehicle_id: vehicleId,
            timestamp: Math.floor(Date.now() / 1000)
        });

        this.mqttClient.publish(topic, payload);
    }

    private extractIdFromTopic(topic:  string): string {
        const parts = topic.split('/');
        return parts[2]; // traffic/light/{id}/control
    }

    disconnect() {
        this.mqttClient.end();
    }
}