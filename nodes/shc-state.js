'use strict';
module.exports = function (RED) {
    class SHCStateNode {
        constructor(config) {
            RED.nodes.createNode(this, config);
            this.stateName = config.state.split('|')[0];
            this.stateId = config.state.split('|')[1];
            this.name = config.name;
            this.shcConfig = RED.nodes.getNode(config.shc);
            if (this.shcConfig) {
                this.shcConfig.checkConnection(this);
                this.shcConfig.registerListener(this);
            }

            /**
             * Enable/disable user defined state if payload is boolean, otherwise get the state
             */
            this.on('input', (msg, send, done) => {
                if (this.stateId && this.shcConfig && this.shcConfig.connected) {
                    if (typeof msg.payload === 'boolean') {
                        this.shcConfig.shc.getBshcClient()
                            .setUserDefinedState(this.stateId, msg.payload).subscribe(() => {
                                done();
                            }, err => {
                                done(err);
                            });
                    } else {
                        this.shcConfig.shc.getBshcClient()
                            .getUserDefinedStates(this.stateId).subscribe(result => {
                                if (result._parsedResponse) {
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
            const msg = {topic: (this.name || this.stateName)};
            msg.payload = data;
            return msg.payload === null ? null : msg;
        }

        listener(data) {
            const parsed = JSON.parse(JSON.stringify(data));
            parsed.forEach(event => {
                if (event.id && this.stateId === event.id) {
                    this.send(this.setMsgObject(event));
                }
            });
        }
    }
    RED.nodes.registerType('shc-state', SHCStateNode);
};
