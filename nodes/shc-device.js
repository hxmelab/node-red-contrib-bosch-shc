'use strict';

module.exports = function (RED) {
    class SHCDeviceNode {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.deviceId = config.device.split('|')[1];
            this.deviceModel = config.device.split('|')[2];
            this.serviceId = config.service;
            this.state = config.state;
            this.name = config.name;

            this.shcConfig = RED.nodes.getNode(config.shc);

            /**
             *
             */
            this.on('input', (msg, send, done) => {
                if (this.shcConfig && this.shcConfig.state === 'PAIRED') {
                    if (this.isValid(msg.payload) && this.getServiceBody(msg.payload)) {
                        this.shcConfig.shc.getBshcClient().putState(this.getPath(), this.getServiceBody(msg.payload)).subscribe(result => {
                            send(result);
                            done();
                        }, err => {
                            done(err);
                        });
                    } else {
                        this.shcConfig.shc.getBshcClient().getDeviceServices(this.deviceId, this.serviceId).subscribe(result => {
                            send(this.setMsgObject(result, msg));
                            done();
                        }, err => {
                            done(err);
                        });
                    }
                }
            });

            /**
             * Check configuration state
             */
            if (this.shcConfig) {
                if (this.shcConfig.state === 'PAIRED') {
                    this.status({fill: 'green', shape: 'dot', text: 'node-red:common.status.connected'});
                } else {
                    this.status({fill: 'blue', shape: 'ring', text: 'Add Client'});
                }
            } else {
                this.status({fill: 'blue', shape: 'ring', text: 'Add Configuration'});
            }

            this.registerListener();
        }

        setMsgObject(res, msg) {
            if (Array.isArray(res)) {
                msg.topic = 'serviceArray';
                msg.payload = res;
            } else {
                if (res.state) {
                    msg.topic = res.state['@type'];
                }

                if (this.state.length > 0) {
                    msg.payload = res.state[this.state];
                } else {
                    msg.payload = res;
                }
            }

            return (msg);
        }

        getPath() {
            return 'devices/' + this.deviceId + '/services/' + this.serviceId;
        }

        isRelevant(msg) {
            return ((this.deviceId === '*' && this.serviceId === '*') ||
                    (this.deviceId === '*' && this.serviceId === msg.id) ||
                    (this.deviceId === msg.deviceId && this.serviceId === '*') ||
                    (this.deviceId === msg.deviceId && this.serviceId === msg.id));
        }

        isValid(newState) {
            switch (this.serviceId) {
                case 'SmokeDetectorCheck':
                case 'PowerSwitch':
                case 'PrivacyMode':
                case 'IntrusionDetectionControl':
                case 'PresenceSimulationConfiguration': return (typeof newState === 'boolean');
                case 'ShutterControl': return (typeof newState === 'number' && newState >= 0 && newState <= 1);
                case 'RoomClimateControl': return (typeof newState === 'number' && newState >= 5 && newState <= 30);
                default: return false;
            }
        }

        getServiceBody(newState) {
            switch (this.serviceId) {
                case 'SmokeDetectorCheck': return {'@type': 'smokeDetectorCheckState', value: 'SMOKE_TEST_REQUESTED'};
                case 'PowerSwitch': return {'@type': 'powerSwitchState', switchState: (newState ? 'ON' : 'OFF')};
                case 'RoomClimateControl': return {'@type': 'climateControlState', setpointTemperature: newState};
                case 'PrivacyMode': return {'@type': 'privacyModeState', value: (newState ? 'ENABLED' : 'DISABLED')};
                case 'IntrusionDetectionControl': return {'@type': 'intrusionDetectionControlState', value: (newState ? 'SYSTEM_ARMED' : 'SYSTEM_DISARMED')};
                case 'PresenceSimulationConfiguration': return {'@type': 'presenceSimulationConfigurationState', enabled: newState};
                case 'ShutterControl': return {'@type': 'shutterControlState', level: newState};
                default: return false;
            }
        }

        listener(data) {
            if (data.error) {
                this.status({fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected'});
            } else {
                this.status({fill: 'green', shape: 'dot', text: 'node-red:common.status.connected'});
                const parsed = JSON.parse(JSON.stringify(data));
                parsed.forEach(msg => {
                    if (this.isRelevant(msg)) {
                        this.send(this.setMsgObject(msg, msg));
                    }
                });
            }
        }

        registerListener() {
            if (this.shcConfig && this.shcConfig.state === 'PAIRED') {
                this.shcConfig.addListener('shc-events', data => {
                    this.listener(data);
                });
            }
        }
    }

    RED.nodes.registerType('shc-device', SHCDeviceNode);
};
