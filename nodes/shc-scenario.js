'use strict';

module.exports = function (RED) {
    class SHCScenarioNode {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.scenarioName = config.scenario.split('|')[0];
            this.scenarioId = config.scenario.split('|')[1];
            this.name = config.name;
            this.shcConfig = RED.nodes.getNode(config.shc);

            if (this.shcConfig) {
                this.shcConfig.checkConnection(this);
                this.shcConfig.registerListener(this);
            }

            /**
             * Any input msg triggers the configured scenario
             */
            this.on('input', (msg, send, done) => {
                if (this.scenarioId && this.shcConfig && this.shcConfig.connected) {
                    this.shcConfig.shc.getBshcClient()
                        .triggerScenario(this.scenarioId).subscribe(() => {
                            done();
                        }, err => {
                            done(err);
                        });
                }
            });
        }

        setMsgObject(data) {
            const msg = {topic: (this.name || this.scenarioName)};
            msg.payload = data;
            return msg.payload === null ? null : msg;
        }

        listener(data) {
            const parsed = JSON.parse(JSON.stringify(data));
            parsed.forEach(event => {
                if (event.id && this.scenarioId === event.id) {
                    this.send(this.setMsgObject(event));
                }
            });
        }
    }

    RED.nodes.registerType('shc-scenario', SHCScenarioNode);
};
