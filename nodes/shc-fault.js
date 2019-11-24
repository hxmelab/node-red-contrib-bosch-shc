"use strict";

module.exports = function (RED) {

    class ShcFaultNode {
        constructor(config) {

            RED.nodes.createNode(this, config);

            this.shcConfig = RED.nodes.getNode(config.shc);
            this.name = config.name;
            this.debug = config.debug;

            
            this.on('input', function(msg, send, done) {

            })

            this.on('close', function(removed, done) {
                if (removed) {
                    this.log('SHC fault node removed');
                } else {
                    this.log('SHC fault node restarted');
                }
                done();
            });

            this.registerListener();

        }

        shcEventsHandler = (data) => {
            if (data.error) {
                this.status({fill: 'red', shape:'ring', text:'node-red:common.status.disconnected'});
            } else {
                this.status({fill: 'green', shape:'dot', text:'node-red:common.status.connected'});
                let parsed = JSON.parse(JSON.stringify(data));
                parsed.forEach(msg => {
                    if (this.debug || msg.faults) {
                        this.send({topic: 'shc-event', payload: msg});
                    }
                });
            }
        }

        registerListener() {
            if (this.shcConfig) {
                if (this.shcConfig.state !== 'PAIRED') {
                    this.status({fill: 'blue', shape:'ring', text:'Add Client'});
                } else {
                    this.status({fill: 'yellow', shape:'dot', text:'node-red:common.status.connecting'});
                    this.shcConfig.addListener("shc-events", this.shcEventsHandler);
                }
            } else {
                this.status({fill: 'blue', shape:'ring', text:'Add Configuration'});
                this.warn('Add Configuration');
            }
        }

    
    }
    RED.nodes.registerType('shc-fault', ShcFaultNode);
    
};






        