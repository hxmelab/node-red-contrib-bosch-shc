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

        registerListener() {
            if (this.shcConfig) {
                if (this.shcConfig.state !== 'PAIRED') {
                    this.status({fill: 'blue', shape:'ring', text:'Add Client'});
                } else {
                    this.status({fill: 'green', shape:'dot', text:'node-red:common.status.connected'});
                    this.listener = (data) => {
                        let parsed = JSON.parse(JSON.stringify(data));
                        parsed.forEach(msg => {
                            if (this.debug || msg.faults) {
                                this.send({topic: msg['@type'], payload: msg});
                            }
                        });
                    }
                    this.shcConfig.addListener("shc-events", this.listener);
                }
            } else {
                this.status({fill: 'blue', shape:'ring', text:'Add Configuration'});
                this.warn('Add Configuration');
            }
        }

    
    }
    RED.nodes.registerType('shc-fault', ShcFaultNode);
    
};






        