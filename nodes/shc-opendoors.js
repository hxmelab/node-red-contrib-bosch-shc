'use strict';
module.exports = function (RED) {
    class SHCOpenDoorsNode {
        constructor(config) {
            RED.nodes.createNode(this, config);
            this.name = config.name;
            this.shcConfig = RED.nodes.getNode(config.shc);
            if (this.shcConfig) {
                this.shcConfig.checkConnection(this);
                this.shcConfig.registerListener(this);
            }
            /**
             * get open doors or windows
             */
            this.on('input', (msg, send, done) => {
                if (this.stateId && this.shcConfig && this.shcConfig.connected) {
                    this.shcConfig.shc.getBshcClient().getOpenWindows().subscribe(result => {
                        send(this.setMsgObject(result._parsedResponse));
                        done();
                    }, err => {
                        done(err);
                    });
                }
            });
        }
        setMsgObject(data) {
            const msg = {topic: (this.name )};
            msg.payload = data;
            return msg.payload === null ? null : msg;
        }
    }
    RED.nodes.registerType('shc-opendoors', SHCOpenDoorsNode);
};
