'use strict';

module.exports = function (RED) {
    class SHCAutomationNode {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.automationName = config.automation.split('|')[0];
            this.automationId = config.automation.split('|')[1];
            this.name = config.name;
            this.shcConfig = RED.nodes.getNode(config.shc);

            if (this.shcConfig) {
                this.shcConfig.checkConnection(this);
                this.shcConfig.registerListener(this);
            }

            /**
             * Any input msg triggers the configured automation
             */
            this.on('input', (msg, send, done) => {
                if (this.automationId && this.shcConfig && this.shcConfig.connected) {
                    this.shcConfig.shc.getBshcClient()
                        .triggerAutomation(this.automationId).subscribe(() => {
                            done();
                        }, err => {
                            done(err);
                        });
                }
            });
        }

        setMsgObject(data) {
            const msg = {topic: (this.name || this.automationName)};
            msg.payload = data;
            return msg.payload === null ? null : msg;
        }

        listener(data) {
            const parsed = JSON.parse(JSON.stringify(data));
            parsed.forEach(event => {
                if (event.id && this.automationId === event.id) {
                    this.send(this.setMsgObject(event));
                }
            });
        }
    }

    RED.nodes.registerType('shc-automation', SHCAutomationNode);
};
