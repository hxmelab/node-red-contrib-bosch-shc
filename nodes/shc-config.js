'use strict';

const mdns = require('node-dns-sd');
const {BoschSmartHomeBridgeBuilder, BshbUtils} = require('bosch-smart-home-bridge');
const ShcLogger = require('./shc-logger.js');

module.exports = function (RED) {
    class ShcConfigNode {
        constructor(config) {
            RED.nodes.createNode(this, config);
            this.setMaxListeners(256);

            this.shcid = config.shcid;
            this.shcip = config.shcip;
            this.clientid = config.clientid;
            this.clientname = config.clientname;
            this.state = config.state;
            this.password = this.credentials.password;
            this.key = this.credentials.key;
            this.cert = this.credentials.cert;

            this.pollid = null;
            this.connected = false;
            this.on('close', this.destructor);

            if (this.state === 'PAIRED') {
                this.shc = BoschSmartHomeBridgeBuilder.builder()
                    .withHost(this.shcip)
                    .withClientCert(this.cert)
                    .withClientPrivateKey(this.key)
                    .withLogger(new ShcLogger())
                    .withIgnoreCertificateCheck(false)
                    .build();

                this.shc.getBshcClient().getInformation().subscribe(() => {
                    this.connected = true;
                    this.emit('shc-events', null);
                    this.poll();
                }, err => {
                    this.reconnect(err);
                });
            }
        }

        async destructor(done) {
            await this.unsubscribe();
            this.shc = null;
            this.pollid = null;
            done();
        }

        isPaired() {
            return (this.state === 'PAIRED');
        }

        reconnect(err) {
            this.connected = false;
            this.emit('shc-events', null);

            if (err && Number.isInteger(err.errorType)) {
                switch (err.errorType) {
                    case 3: { this.pollid = null;
                        break;
                    }

                    default: { this.error(err + ' Type ' + err.errorType + ', Try to reconnect...');
                    }
                }
            } else if (err) {
                this.error(err);
            }

            setTimeout(() => {
                this.poll();
            }, 20_000);
        }

        /**
         * Check connection state and set status.
         */
        checkConnection(node) {
            if (node.shcConfig && node.shcConfig.isPaired()) {
                if (node.shcConfig.connected) {
                    node.status({fill: 'green', shape: 'dot', text: 'node-red:common.status.connected'});
                } else {
                    node.status({fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected'});
                }
            } else {
                node.status({fill: 'blue', shape: 'ring', text: 'not paired'});
            }
        }

        registerListener(node) {
            if (node.shcConfig && node.shcConfig.isPaired()) {
                node.shcConfig.addListener('shc-events', data => {
                    node.shcConfig.checkConnection(node);
                    if (data) {
                        node.listener(data);
                    }
                });
            }
        }

        subscribe() {
            if (this.shc) {
                this.shc.getBshcClient().subscribe().subscribe(data => {
                    if (data && data._parsedResponse && data._parsedResponse.result) {
                        this.pollid = data._parsedResponse.result;
                        this.log('Long polling SHC: ' + this.shcip + ' with poll Id: ' + this.pollid);
                        this.poll();
                    } else {
                        this.reconnect();
                    }
                }, err => {
                    this.reconnect(err);
                });
            }
        }

        poll() {
            if (this.pollid) {
                this.shc.getBshcClient().longPolling(this.pollid).subscribe(data => {
                    this.connected = true;
                    if (data && data._parsedResponse && data._parsedResponse.result) {
                        this.emit('shc-events', data._parsedResponse.result);
                        this.poll();
                    } else {
                        this.reconnect();
                    }
                }, err => {
                    this.reconnect(err);
                });
            } else {
                this.subscribe();
            }
        }

        unsubscribe() {
            return new Promise(resolve => {
                if (this.state === 'PAIRED' && this.pollid) {
                    this.shc.getBshcClient().unsubscribe(this.pollid).subscribe(() => {
                        this.log('Unsubscribed SHC: ' + this.shcip + ' with poll Id: ' + this.pollid);
                        resolve();
                    });
                } else {
                    resolve();
                }
            });
        }
    }

    /**
     * Webhook for discovering SHCs in local network
     */
    RED.httpAdmin.get('/shc/discover', RED.auth.needsPermission('shc.read'), (req, result) => {
        function filter(res) {
            const filterList = [];
            res.forEach(element => {
                if (element && element.fqdn && element.fqdn.includes('Bosch SHC')) {
                    if (element.packet && element.packet.additionals) {
                        element.packet.additionals.forEach(record => {
                            if (record && record.class === 'IN' && ['A', 'AAAA'].includes(record.type)) {
                                if (!filterList.some(e => e.address === record.rdata)) {
                                    filterList.push({address: record.rdata, fqdn: element.fqdn});
                                }
                            }
                        });
                    }
                }
            });
            result.set({'content-type': 'application/json; charset=utf-8'});
            result.end(JSON.stringify(filterList));
        }

        async function discover() {
            const res = await mdns.discover({name: '_http._tcp.local'});
            filter(res);
        }

        discover();
    });

    /**
     * Webhook for generating an identifier
     */
    RED.httpAdmin.get('/shc/id', RED.auth.needsPermission('shc.read'), (req, result) => {
        result.set({'content-type': 'application/json; charset=utf-8'});
        result.end(JSON.stringify('node-red-contrib-bosch-shc-' + ('0000000000' + Math.floor(Math.random() * 10_000_000_000)).slice(-10)));
    });

    /**
     * Webhook for generating a certificate and a key
     */
    RED.httpAdmin.get('/shc/tls', RED.auth.needsPermission('shc.read'), (req, result) => {
        result.set({'content-type': 'application/json; charset=utf-8'});
        result.end(JSON.stringify(BshbUtils.generateClientCertificate()));
    });

    /**
     * Webhook to add a client
     */
    RED.httpAdmin.get('/shc/client', RED.auth.needsPermission('shc.write'), (req, result) => {
        const shc = new BoschSmartHomeBridgeBuilder.builder()
            .withHost(req.query.shcip)
            .withClientCert(req.query.cert)
            .withClientPrivateKey(req.query.key)
            .withLogger(new ShcLogger())
            .build();

        result.set({'content-type': 'text/plain; charset=utf-8'});
        shc.pairIfNeeded(req.query.clientname, req.query.clientid, req.query.password, 0, -1).subscribe(res => {
            if (res && res._parsedResponse && res._parsedResponse && res._parsedResponse.token) {
                result.end('PAIRED');
            } else {
                result.end('ERROR - Please check password');
            }
        }, err => {
            // EPROTO should be SSL alert number 42
            if (err.cause && err.cause.code && err.cause.code === 'EPROTO') {
                result.end('ERROR - Please longpress button on SHC');
            } else if (err.errorType && err.errorType === 2) {
                result.end('ERROR - Please check IP of SHC');
            } else {
                console.log(err);
                result.end('ERROR - Please check logs');
            }
        });
    });

    /**
     * Webhook to fetch scenario list
     */
    RED.httpAdmin.get('/shc/scenarios', RED.auth.needsPermission('shc.read'), (req, result) => {
        const configNode = RED.nodes.getNode(req.query.config);
        if (!configNode) {
            return;
        }

        const shc = new BoschSmartHomeBridgeBuilder.builder()
            .withHost(configNode.shcip)
            .withClientCert(configNode.credentials.cert)
            .withClientPrivateKey(configNode.credentials.key)
            .withLogger(new ShcLogger())
            .build();

        shc.getBshcClient().getScenarios().subscribe(res => {
            if (res && res._parsedResponse) {
                result.set({'content-type': 'application/json; charset=utf-8'});
                result.end(JSON.stringify(res._parsedResponse));
            }
        }, err => {
            console.log(err);
            result.set({'content-type': 'application/json; charset=utf-8'});
            result.end('[]');
        });
    });

    /**
     * Webhook to fetch room list
     */
    RED.httpAdmin.get('/shc/rooms', RED.auth.needsPermission('shc.read'), (req, result) => {
        const configNode = RED.nodes.getNode(req.query.config);
        if (!configNode) {
            return;
        }

        const shc = new BoschSmartHomeBridgeBuilder.builder()
            .withHost(configNode.shcip)
            .withClientCert(configNode.credentials.cert)
            .withClientPrivateKey(configNode.credentials.key)
            .withLogger(new ShcLogger())
            .build();

        shc.getBshcClient().getRooms().subscribe(res => {
            if (res && res._parsedResponse) {
                result.set({'content-type': 'application/json; charset=utf-8'});
                result.end(JSON.stringify(res._parsedResponse));
            }
        }, err => {
            console.log(err);
            result.set({'content-type': 'application/json; charset=utf-8'});
            result.end('[]');
        });
    });

    /**
     * Webhook to fetch device list
     */
    RED.httpAdmin.get('/shc/devices', RED.auth.needsPermission('shc.read'), (req, result) => {
        const configNode = RED.nodes.getNode(req.query.config);
        if (!configNode) {
            return;
        }

        const shc = new BoschSmartHomeBridgeBuilder.builder()
            .withHost(configNode.shcip)
            .withClientCert(configNode.credentials.cert)
            .withClientPrivateKey(configNode.credentials.key)
            .withLogger(new ShcLogger())
            .build();

        shc.getBshcClient().getDevices().subscribe(res => {
            if (res && res._parsedResponse) {
                result.set({'content-type': 'application/json; charset=utf-8'});
                result.end(JSON.stringify(res._parsedResponse));
            }
        }, err => {
            console.log(err);
            result.set({'content-type': 'application/json; charset=utf-8'});
            result.end('[]');
        });
    });

    /**
     * Webhook to fetch service list
     */
    RED.httpAdmin.get('/shc/services', RED.auth.needsPermission('shc.read'), (req, result) => {
        const configNode = RED.nodes.getNode(req.query.config);
        if (!configNode) {
            return;
        }

        const shc = new BoschSmartHomeBridgeBuilder.builder()
            .withHost(configNode.shcip)
            .withClientCert(configNode.credentials.cert)
            .withClientPrivateKey(configNode.credentials.key)
            .withLogger(new ShcLogger())
            .build();

        shc.getBshcClient().getDeviceServices().subscribe(res => {
            if (res && res._parsedResponse) {
                result.set({'content-type': 'application/json; charset=utf-8'});
                result.end(JSON.stringify(res._parsedResponse));
            }
        }, err => {
            console.log(err);
            result.set({'content-type': 'application/json; charset=utf-8'});
            result.end('[]');
        });
    });

    RED.nodes.registerType('shc-config', ShcConfigNode, {
        credentials: {
            password: {type: 'password'},
            key: {type: 'password'},
            cert: {type: 'password'},
        },
    });
};
