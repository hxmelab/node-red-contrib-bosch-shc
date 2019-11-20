"use strict";

module.exports = function (RED) {

    class ShcFaultNode {
        constructor(n) {

            RED.nodes.createNode(this, n);

            this.shcConfig = RED.nodes.getNode(n.shc);
            this.name = n.name;

            
            this.on('input', function(msg, send, done) {

            })

            this.on('close', function(removed, done) {
                if (removed) {
                    node.log('SHC fault node removed');
                } else {
                    node.log('SHC fault node restarted');
                }
                done();
            });

        }

        registerListener() {
            if (node.shcConfig) {

                node.listener = (data) => {
                    let parsed = JSON.parse(JSON.stringify(data));
                    console.log("data " + JSON.stringify(parsed));
                    parsed.forEach(msg => {
                        node.send({topic: msg['@type'], payload: msg});
                    });
                }
                
                node.shcConfig.addListener("shc-events", node.listener);
                
                if (node.shcConfig.pollid.length > 0) {
                    node.status({fill: 'yellow', shape:'ring', text:'node-red:common.status.connecting'});
                    //node.connect();

                } else {
                    node.status({fill: 'blue', shape:'ring', text:'Add Client'});
                }
            } else {
                node.status({fill: 'blue', shape:'ring', text:'Add Configuration'});
                node.warn('Add Configuration');
            }
        }

    
    }
    RED.nodes.registerType('shc-fault', ShcFaultNode);
    
};






        