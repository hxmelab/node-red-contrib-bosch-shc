'use strict';

module.exports = function (RED) {
    class ShcFaultNode {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.shcConfig = RED.nodes.getNode(config.shc);
            this.name = config.name;
            this.debug = config.debug;

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

        listener(data) {
            if (data.error) {
                this.status({fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected'});
            } else {
                this.status({fill: 'green', shape: 'dot', text: 'node-red:common.status.connected'});
                const parsed = JSON.parse(JSON.stringify(data));
                parsed.forEach(msg => {
                    if (this.debug || msg.faults) {
                        this.send({topic: 'shc-event', payload: msg});
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

    RED.nodes.registerType('shc-fault', ShcFaultNode);
};

