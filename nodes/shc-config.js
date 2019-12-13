'use strict';

const mdns = require('node-dns-sd');

const {BoschSmartHomeBridgeBuilder, BshbUtils} = require('bosch-smart-home-bridge');
const ShcLogger = require('./shc-logger');

module.exports = function (RED) {
    class ShcConfigNode {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.shcid = config.shcid;
            this.shcip = config.shcip;
            this.clientid = config.clientid;
            this.clientname = config.clientname;
            this.state = config.state;
            this.password = this.credentials.password;
            this.private = JSON.stringify(this.credentials.private);
            this.cert = JSON.stringify(this.credentials.cert);

            this.pollid = null;
            this.on('close', this.destructor);

            if (this.state === 'PAIRED') {
                this.shc = new BoschSmartHomeBridgeBuilder.builder()
                    .withHost(this.shcip)
                    .withClientCert(JSON.parse(this.cert))
                    .withClientPrivateKey(JSON.parse(this.private))
                    .withLogger(new ShcLogger())
                    .build();

                this.poll();
            }
        }

        async destructor(done) {
            await this.unsubscribe();
            done();
        }

        subscribe() {
            this.shc.getBshcClient().subscribe('').subscribe(result => {
                this.pollid = result.result;
                this.log('Long polling SHC: ' + this.shcip + ' with poll Id: ' + this.pollid);
                this.emit('shc-events', []);
                this.poll();
            }, err => {
                this.error(err);
                this.emit('shc-events', {error: err});
            });
        }

        poll() {
            if (this.pollid) {
                this.shc.getBshcClient().longPolling('', this.pollid).subscribe(data => {
                    if (data.result) {
                        this.emit('shc-events', data.result);
                        this.poll();
                    }
                }, err => {
                    this.error(err);
                    this.emit('shc-events', {error: err});
                });
            } else {
                this.subscribe();
            }
        }

        unsubscribe() {
            return new Promise(resolve => {
                if (this.state === 'PAIRED' && this.pollid) {
                    this.shc.getBshcClient().unsubscribe('', this.pollid).subscribe(() => {
                        this.log('Unsubscribe SHC: ' + this.shcip + ' with poll Id: ' + this.pollid);
                        this.pollid = null;
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
                if (Object.prototype.hasOwnProperty.call(element, 'fqdn') && element.fqdn.includes('Bosch SHC')) {
                    filterList.push(element);
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
        result.end(JSON.stringify('node-red-contrib-bosch-shc-' + ('0000000000' + Math.floor(Math.random() * 10000000000)).slice(-10)));
    });

    /**
     * Webhook for generating a certificate and a key
     */
    RED.httpAdmin.get('/shc/tls', RED.auth.needsPermission('shc.read'), (req, result) => {
        const tls = BshbUtils.generateClientCertificate();
        const data = JSON.stringify(tls.private) + '|' + JSON.stringify(tls.cert);

        result.set({'content-type': 'charset=utf-8'});
        result.end(data);
    });

    /**
     * Webhook to add a client
     */
    RED.httpAdmin.get('/shc/client', RED.auth.needsPermission('shc.write'), (req, result) => {
        const shc = new BoschSmartHomeBridgeBuilder.builder()
            .withHost(req.query.shcip)
            .withClientCert(JSON.parse(req.query.cert))
            .withClientPrivateKey(JSON.parse(req.query.private))
            .withLogger(new ShcLogger())
            .build();

        result.set({'content-type': 'charset=utf-8'});
        shc.pairIfNeeded(req.query.clientname, req.query.clientid, req.query.password, 0, -1).subscribe(res => {
            if (res && res._parsedResponse && res._parsedResponse && res._parsedResponse.token) {
                result.end('PAIRED');
            } else {
                result.end('ERROR - Wrong Password?');
            }
        }, err => {
            if (err.message.includes('SSL alert number 42')) {
                result.end('ERROR - Button pressed?');
            } else {
                console.log(err);
                result.end('ERROR - Please check logs!');
            }
        });
    });

    /**
     * Webhook to fetch scenario list
     */
    RED.httpAdmin.get('/shc/scenarios', RED.auth.needsPermission('shc.read'), (req, result) => {
        const shc = new BoschSmartHomeBridgeBuilder.builder()
            .withHost(req.query.shcip)
            .withClientCert(JSON.parse(req.query.cert))
            .withClientPrivateKey(JSON.parse(req.query.private))
            .withLogger(new ShcLogger())
            .build();

        shc.getBshcClient().getScenarios().subscribe(res => {
            if (res) {
                result.set({'content-type': 'application/json; charset=utf-8'});
                result.end(JSON.stringify(res));
            }
        }, err => {
            this.error(err);
            result.set({'content-type': 'application/json; charset=utf-8'});
            result.end('[]');
        });
    });

    /**
     * Webhook to fetch room list
     */
    RED.httpAdmin.get('/shc/rooms', RED.auth.needsPermission('shc.read'), (req, result) => {
        const shc = new BoschSmartHomeBridgeBuilder.builder()
            .withHost(req.query.shcip)
            .withClientCert(JSON.parse(req.query.cert))
            .withClientPrivateKey(JSON.parse(req.query.private))
            .withLogger(new ShcLogger())
            .build();

        shc.getBshcClient().getRooms().subscribe(res => {
            if (res) {
                result.set({'content-type': 'application/json; charset=utf-8'});
                result.end(JSON.stringify(res));
            }
        }, err => {
            this.error(err);
            result.set({'content-type': 'application/json; charset=utf-8'});
            result.end('[]');
        });
    });

    /**
     * Webhook to fetch device list
     */
    RED.httpAdmin.get('/shc/devices', RED.auth.needsPermission('shc.read'), (req, result) => {
        const shc = new BoschSmartHomeBridgeBuilder.builder()
            .withHost(req.query.shcip)
            .withClientCert(JSON.parse(req.query.cert))
            .withClientPrivateKey(JSON.parse(req.query.private))
            .withLogger(new ShcLogger())
            .build();

        shc.getBshcClient().getDevices().subscribe(res => {
            if (res) {
                result.set({'content-type': 'application/json; charset=utf-8'});
                result.end(JSON.stringify(res));
            }
        }, err => {
            this.error(err);
            result.set({'content-type': 'application/json; charset=utf-8'});
            result.end('[]');
        });
    });

    /**
     * Webhook to fetch service list
     */
    RED.httpAdmin.get('/shc/services', RED.auth.needsPermission('shc.read'), (req, result) => {
        const shc = new BoschSmartHomeBridgeBuilder.builder()
            .withHost(req.query.shcip)
            .withClientCert(JSON.parse(req.query.cert))
            .withClientPrivateKey(JSON.parse(req.query.private))
            .withLogger(new ShcLogger())
            .build();

        shc.getBshcClient().getDeviceServices().subscribe(res => {
            if (res) {
                result.set({'content-type': 'application/json; charset=utf-8'});
                result.end(JSON.stringify(res));
            }
        }, err => {
            this.error(err);
            result.set({'content-type': 'application/json; charset=utf-8'});
            result.end('[]');
        });
    });

    RED.nodes.registerType('shc-config', ShcConfigNode, {
        credentials: {
            password: {type: 'password'},
            private: {type: 'password'},
            cert: {type: 'password'}
        }
    });
};
