"use strict";

module.exports = function(RED) {

    class SHCDeviceNode {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.deviceId = config.device.split('|')[1];
            this.serviceId = config.service;
            this.state = config.state;
            this.name = config.name;

            this.shcConfig = RED.nodes.getNode(config.shc);

            /**
             * 
             */
            this.on('input', function(msg, send, done) {
                if (this.shcConfig && this.shcConfig.state === 'PAIRED') {                    
                    this.shcConfig.shc.getBshcClient().getDeviceServices(this.deviceId, this.serviceId).subscribe(result => {
                        send(this.setMsgObject(result, msg));
                        done();
                    }, err => {
                        done(err);
                    });
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