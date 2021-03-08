'use strict';

module.exports = function (RED) {
    class SHCDeviceNode {
        constructor(config) {
            RED.nodes.createNode(this, config);

            // In v0.3.22 introduced property, default true
            if (typeof config.poll === 'undefined') {
                config.poll = true;
            }

            this.deviceName = config.device.split('|')[0];
            this.deviceId = config.device.split('|')[1];
            this.deviceModel = config.device.split('|')[2];
            this.serviceId = config.service;
            this.state = config.state;
            this.poll = config.poll;
            this.name = config.name;

            this.shcConfig = RED.nodes.getNode(config.shc);

            if (this.shcConfig) {
                this.shcConfig.checkConnection(this);
                this.shcConfig.registerListener(this);
            }

            /**
             *  Handle node input
             */
            this.on('input', (msg, send, done) => {
                if (this.shcConfig && this.shcConfig.connected) {
                    // Set a state on a single device service
                    if (this.isValid(msg.payload) && this.serviceId && this.getServiceBody(msg.payload)) {
                        if (this.deviceId === 'all') {
                            // ToDo: Add method to handle multiple actions, e.g. reset all power meters
                            done();
                        } else {
                            this.shcConfig.shc.getBshcClient().putState(this.getPath(),
                                this.getServiceBody(msg.payload)).subscribe(result => {
                                if (result._parsedResponse && result._parsedResponse.message) {
                                    send({topic: this.deviceName, payload: result._parsedResponse.message});
                                }

                                done();
                            }, err => {
                                done(err);
                            });
                        }
                        // Get all device services regardless of a device
                    } else if (this.deviceId === 'all' && this.serviceId) {
                        this.shcConfig.shc.getBshcClient()
                            .getDeviceServices(undefined, undefined).subscribe(result => {
                                send(this.setMsgArray(result._parsedResponse.filter(element => {
                                    if (this.serviceId === 'all') {
                                        return true;
                                    }

                                    return this.serviceId === element.id;
                                }).map(element => {
                                    if (this.setMsgObject(element)) {
                                        return this.setMsgObject(element).payload;
                                    }

                                    return null;
                                })));
                                done();
                            }, err => {
                                done(err);
                            });
                        // Get one or all device services of a specific device
                    } else if (this.deviceId && this.serviceId) {
                        this.shcConfig.shc.getBshcClient()
                            .getDeviceServices(this.deviceId, this.serviceId).subscribe(result => {
                                if (Array.isArray(result._parsedResponse)) {
                                    result._parsedResponse.forEach(service => {
                                        send(this.setMsgObject(service));
                                    });
                                } else {
                                    send(this.setMsgObject(result._parsedResponse));
                                }

                                done();
                            }, err => {
                                done(err);
                            });
                        // Get the device meta data of a specific device or of all devices
                    } else if (this.deviceId) {
                        this.shcConfig.shc.getBshcClient()
                            .getDevice(this.deviceId === 'all' ? undefined : this.deviceId).subscribe(result => {
                                send(this.setMsgObject(result._parsedResponse));
                                done();
                            }, err => {
                                done(err);
                            });
                    }
                }
            });
        }

        setMsgArray(data) {
            const msg = {topic: (this.name || this.serviceId)};
            msg.payload = data;
            return msg.payload === null ? null : msg;
        }

        setMsgObject(data) {
            const msg = {topic: (this.name || this.deviceName)};
            if (this.serviceId && this.state) {
                if (data.state && Object.prototype.hasOwnProperty.call(data.state, this.state)) {
                    msg.payload = this.convertState(data.state[this.state]);
                } else {
                    return null;
                }
            } else {
                msg.payload = data;
            }

            return msg.payload === null ? null : msg;
        }

        getPath() {
            return 'devices/' + this.deviceId + '/services/' + this.serviceId;
        }

        isRelevant(msg) {
            return ((msg['@type'] === 'DeviceServiceData' && this.deviceId === 'all' && this.serviceId === 'all') ||
                    (msg['@type'] === 'device' && this.deviceId === 'all' && !this.serviceId) ||
                    (msg['@type'] === 'DeviceServiceData' && this.deviceId === 'all' && this.serviceId === msg.id) ||
                    (msg['@type'] === 'DeviceServiceData' && this.deviceId === msg.deviceId && this.serviceId === 'all') ||
                    (msg['@type'] === 'device' && this.deviceId === msg.id && !this.serviceId) ||
                    (msg['@type'] === 'DeviceServiceData' && this.deviceId === msg.deviceId && this.serviceId === msg.id));
        }

        isValid(newState) {
            switch (this.serviceId) {
                case 'BinarySwitch':
                case 'HueBlinkingActuator':
                case 'SmokeDetectorCheck':
                case 'PowerSwitch':
                case 'PowerMeter':
                case 'PrivacyMode':
                case 'IntrusionDetectionControl':
                case 'PresenceSimulationConfiguration': return (typeof newState === 'boolean');
                case 'ShutterControl': return (typeof newState === 'number' && newState >= 0 && newState <= 1) || typeof newState === 'string';
                case 'HeatingCircuit':
                case 'RoomClimateControl': return (typeof newState === 'number' && newState >= 5 && newState <= 30);
                case 'MultiLevelSwitch': return (typeof newState === 'number' && newState >= 0 && newState <= 100);
                case 'HSBColorActuator': return (typeof newState === 'number' && newState < 0);
                case 'HueColorTemperature': return (typeof newState === 'number' && newState > 152 && newState < 501);
                default: return false;
            }
        }

        getServiceBody(newState) {
            switch (this.serviceId) {
                case 'BinarySwitch': return {'@type': 'binarySwitchState', on: newState};
                case 'MultiLevelSwitch': return {'@type': 'multiLevelSwitchState', level: newState};
                case 'HSBColorActuator': return {'@type': 'colorState', rgb: newState};
                case 'HueColorTemperature': return {'@type': 'colorTemperatureState', colorTemperature: newState};
                case 'HueBlinkingActuator': return {'@type': 'hueBlinkingState', blinkingState: (newState ? 'ON' : 'OFF')};
                case 'SmokeDetectorCheck': return {'@type': 'smokeDetectorCheckState', value: 'SMOKE_TEST_REQUESTED'};
                case 'PowerSwitch': return {'@type': 'powerSwitchState', switchState: (newState ? 'ON' : 'OFF')};
                case 'PowerMeter': return {'@type': 'powerMeterState', energyConsumption: 0};
                case 'HeatingCircuit': return {'@type': 'heatingCircuitState', setpointTemperature: (newState * 2).toFixed() / 2};
                case 'RoomClimateControl': return {'@type': 'climateControlState', setpointTemperature: (newState * 2).toFixed() / 2};
                case 'PrivacyMode': return {'@type': 'privacyModeState', value: (newState ? 'DISABLED' : 'ENABLED')};
                case 'IntrusionDetectionControl': return {'@type': 'intrusionDetectionControlState', value: (newState ? 'SYSTEM_ARMED' : 'SYSTEM_DISARMED')};
                case 'PresenceSimulationConfiguration': return {'@type': 'presenceSimulationConfigurationState', enabled: newState};
                case 'ShutterControl':
                    if (typeof newState === 'string') {
                        switch (newState.toUpperCase()) {
                            case 'STOP': return {'@type': 'shutterControlState', operationState: 'STOPPED'};
                            case 'OPEN': return {'@type': 'shutterControlState', level: 1};
                            case 'CLOSE': return {'@type': 'shutterControlState', level: 0};
                            default: return false;
                        }
                    }

                    return {'@type': 'shutterControlState', level: newState};
                default: return false;
            }
        }

        convertState(state) {
            if (state === 'ON' || state === 'DISABLED' || state === 'SYSTEM_ARMED') {
                return true;
            }

            if (state === 'OFF' || state === 'ENABLED' || state === 'SYSTEM_DISARMED') {
                return false;
            }

            if (state === 'SYSTEM_ARMING') {
                return null;
            }

            return state;
        }

        listener(data) {
            const parsed = JSON.parse(JSON.stringify(data));
            parsed.forEach(event => {
                if (this.poll && this.isRelevant(event)) {
                    this.send(this.setMsgObject(event));
                }
            });
        }
    }

    RED.nodes.registerType('shc-device', SHCDeviceNode);
};
