'use strict';

module.exports = function (RED) {
    class ShcFaultNode {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.shcConfig = RED.nodes.getNode(config.shc);
            this.name = config.name;
            this.debug = config.debug;

            if (this.shcConfig) {
                this.shcConfig.checkConnection(this);
                this.shcConfig.registerListener(this);
            }
        }

        listener(data) {
            const parsed = JSON.parse(JSON.stringify(data));
            parsed.forEach(event => {
                if (this.debug || event.faults) {
                    this.send({topic: 'shc-event', payload: event});
                }
            });
        }
    }

    RED.nodes.registerType('shc-fault', ShcFaultNode);
};

