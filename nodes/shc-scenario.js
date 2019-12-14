'use strict';

module.exports = function (RED) {
    class SHCScenarioNode {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.scenario = config.scenario.split('|')[1];
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
                if (this.scenario && this.shcConfig && this.shcConfig.connected) {
                    this.shcConfig.shc.getBshcClient()
                        .triggerScenario(this.scenario).subscribe(() => {
                            done();
                        }, err => {
                            done(err);
                        });
                }
            });
        }

        listener() {}
    }

    RED.nodes.registerType('shc-scenario', SHCScenarioNode);
};
