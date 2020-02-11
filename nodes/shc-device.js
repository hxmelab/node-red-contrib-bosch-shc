'use strict';

module.exports = function (RED) {
    class SHCDeviceNode {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.deviceName = config.device.split('|')[0];
            this.deviceId = config.device.split('|')[1];
            this.deviceModel = config.device.split('|')[2];
            this.serviceId = config.service;
            this.state = config.state;
            this.name = config.name;

            this.shcConfig = RED.nodes.getNode(config.shc);

            if (this.shcConfig) {
                this.shcConfig.checkConnection(this);
                this.shcConfig.registerListener(this);
            }

            /**
             *
             */
            this.on('input', (msg, send, done) => {
                if (this.shcConfig && this.shcConfig.connected) {
                    if (this.isValid(msg.payload) && this.getServiceBody(msg.payload)) {
                        this.shcConfig.shc.getBshcClient().putState(this.getPath(),
                            this.getServiceBody(msg.payload)).subscribe(result => {
                            if (result._parsedResponse && result._parsedResponse.message) {
                                send({topic: this.deviceName, payload: result._parsedResponse.message});
                            }

                            done();
                        }, err => {
                            done(err);
                        });
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
                    }
                }
            });
        }

        setMsgObject(data) {
            const msg = {topic: (this.name || this.deviceName)};
            if (this.state) {
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
            return ((this.deviceId === 'all' && this.serviceId === 'all') ||
                    (this.deviceId === 'all' && this.serviceId === msg.id) ||
                    (this.deviceId === msg.deviceId && this.serviceId === 'all') ||
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
                case 'RoomClimateControl': return {'@type': 'climateControlState', setpointTemperature: (newState  * 2).toFixed() / 2};
                case 'PrivacyMode': return {'@type': 'privacyModeState', value: (newState ? 'DISABLED' : 'ENABLED')};
                case 'IntrusionDetectionControl': return {'@type': 'intrusionDetectionControlState', value: (newState ? 'SYSTEM_ARMED' : 'SYSTEM_DISARMED')};
                case 'PresenceSimulationConfiguration': return {'@type': 'presenceSimulationConfigurationState', enabled: newState};
                case 'ShutterControl': return {'@type': 'shutterControlState', level: newState};
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
                if (event.state && this.isRelevant(event)) {
                    this.send(this.setMsgObject(event));
                }
            });
        }
    }

    RED.nodes.registerType('shc-device', SHCDeviceNode);
};
