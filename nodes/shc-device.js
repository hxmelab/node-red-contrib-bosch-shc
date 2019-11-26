"use strict";

module.exports = function(RED) {

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
            this.on('input', function(msg, send, done) {
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
                if (this.shcConfig.state !== 'PAIRED') {
                    this.status({fill: 'blue', shape:'ring', text:'Add Client'});
                } else {
                    this.status({fill: 'green', shape:'dot', text:'node-red:common.status.connected'});                
                } 
            } else {
                this.status({fill: 'blue', shape:'ring', text:'Add Configuration'});
            }

            this.registerListener();

        }

        setMsgObject(res, msg) {
            if (res.length) {
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
            return(msg);
        }

        isRelevant(msg) {
            return ((this.deviceId === '*' && this.serviceId === '*') ||
                    (this.deviceId === '*' && this.serviceId === msg.id) ||
                    (this.deviceId === msg.deviceId && this.serviceId === '*') ||
                    (this.deviceId === msg.deviceId && this.serviceId === msg.id));
        }

        isValid(newState) {
            switch(this.deviceModel) {
                case 'SD':
                case 'BSM':
                case 'PSM':
                case 'CAMERA_EYES':
                case 'CAMERA_360':
                case 'TWINGUARD':
                case 'INTRUSION_DETECTION_SYSTEM':
                case 'PRESENCE_SIMULATION_SERVICE': return (typeof newState === 'boolean');
                case 'BBL': return (typeof newState === 'number' && newState >= 0.00 && newState <= 1.00);
                case 'ROOM_CLIMATE_CONTROL': return (typeof newState === 'number' && newState > 4 && newState < 31);
                default: return false;
            }
        }

        getPath() {
            return 'devices/' + this.deviceId + '/services/' + this.serviceId;
        }

        getServiceBody(newState) {
            switch(this.serviceId) {
                case 'SmokeDetectorCheck': return {'@type': 'smokeDetectorCheckState', 'value': 'SMOKE_TEST_REQUESTED'};
                case 'PowerSwitch': return {'@type': 'powerSwitchState', 'switchState': (newState ? 'ON' : 'OFF')};
                case 'RoomClimateControl': return {'@type': 'climateControlState', 'setpointTemperature': newState};
                case 'PrivacyMode': return {'@type': 'privacyModeState', 'value': (newState ? 'ENABLED':'DISABLED')};
                case 'IntrusionDetectionControl': return {'@type': 'intrusionDetectionControlState', 'value': ( newState ? 'SYSTEM_ARMED':'SYSTEM_DISARMED' )};
                case 'PresenceSimulationConfiguration': return {'@type': 'presenceSimulationConfigurationState', 'enabled': newState};
                case 'ShutterControl': return {'@type': 'shutterControlState', 'level': newState};
                default: return false;
            }
        }

        shcEventsHandler = (data) => {
            if (data.error) {
                this.status({fill: 'red', shape:'ring', text:'node-red:common.status.disconnected'});
            } else {
                this.status({fill: 'green', shape:'dot', text:'node-red:common.status.connected'});
                let parsed = JSON.parse(JSON.stringify(data));
                parsed.forEach(msg => {
                    if (this.isRelevant(msg)) {
                        this.send(this.setMsgObject(msg, msg));
                    }
                });
            }
        }

        registerListener() {
            if (this.shcConfig && this.shcConfig.state === 'PAIRED') {
                this.shcConfig.addListener("shc-events", this.shcEventsHandler);
            }
        }

    }

    RED.nodes.registerType("shc-device", SHCDeviceNode);
}