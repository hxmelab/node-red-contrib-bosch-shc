'use strict';

const path = require('path');
const mkdirp = require('mkdirp');
const mdns = require('node-dns-sd');

const {BoschSmartHomeBridge} = require('bosch-smart-home-bridge');
const ShcLogger = require('./shc-logger');

module.exports = function (RED) {
    class ShcConfigNode {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.shcid = config.shcid;
            this.shcip = config.shcip;
            this.clientid = config.clientid;
            this.clientname = config.clientname;
            this.path = config.path;
            this.state = config.state;
            this.password = this.credentials.password;

            this.pollid = '';
            this.on('close', this.destructor);

            this.certDir = path.join(RED.settings.userDir, 'certs');
            mkdirp(this.certDir, err => {
                if (err) {
                    this.error(err);
                }
            });

            if (this.state === 'PAIRED') {
                this.shc = new BoschSmartHomeBridge(this.shcip, this.clientid, this.certDir, new ShcLogger());
                this.poll();
            }
        }

        async destructor(done) {
            if (this.pollid.length > 0) {
                await this.unsubscribe();
                done();
            }
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
            if (this.pollid.length > 0) {
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
            return new Promise((resolve, reject) => {
                if (this.pollid.length > 0) {
                    this.shc.getBshcClient().unsubscribe('', this.pollid).subscribe(() => {
                        this.log('Unsubscribe SHC: ' + this.shcip + ' with poll Id: ' + this.pollid);
                        this.pollid = '';
                        resolve();
                    }, err => {
                        reject(err);
                    });
                }
            });
        }
    }

    /**
     * Webhook for generating an identifier
     */
    RED.httpAdmin.get('/shc/id', (req, result) => {
        result.set({'content-type': 'application/json; charset=utf-8'});
        result.end(JSON.stringify('node-red-contrib-bosch-shc-' + ('0000000000' + Math.floor(Math.random() * 10000000000)).slice(-10)));
    });

    /**
     * Webhook for discovering SHCs in local network
     */
    RED.httpAdmin.get('/shc/discover', (req, result) => {
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
     * Webhook to add a client
     */
    RED.httpAdmin.get('/shc/client', (req, result) => {
        const cert = path.join(RED.settings.userDir, 'certs');
        const shc = new BoschSmartHomeBridge(req.query.shcip, req.query.clientid, cert, new ShcLogger());

        shc.pairIfNeeded(req.query.clientname, req.query.password, 0, 10).subscribe(res => {
            if (res && res.token) {
                result.set({'content-type': 'application/json; charset=utf-8'});
                result.end('PAIRED');
            } else {
                result.set({'content-type': 'application/json; charset=utf-8'});
                result.end('ERROR - Wrong Password?');
            }
        }, err => {
            this.error(err);
            result.set({'content-type': 'application/json; charset=utf-8'});
            result.end('ERROR - Button pressed?');
        });
    });

    /**
     * Webhook to fetch scenario list
     */
    RED.httpAdmin.get('/shc/scenarios', (req, result) => {
        const cert = path.join(RED.settings.userDir, 'certs');
        const shc = new BoschSmartHomeBridge(req.query.shcip, req.query.clientid, cert, new ShcLogger());

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
    RED.httpAdmin.get('/shc/rooms', (req, result) => {
        const cert = path.join(RED.settings.userDir, 'certs');
        const shc = new BoschSmartHomeBridge(req.query.shcip, req.query.clientid, cert, new ShcLogger());

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
    RED.httpAdmin.get('/shc/devices', (req, result) => {
        const cert = path.join(RED.settings.userDir, 'certs');
        const shc = new BoschSmartHomeBridge(req.query.shcip, req.query.clientid, cert, new ShcLogger());

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
     * Webhook to fetch device list
     */
    RED.httpAdmin.get('/shc/services', (req, result) => {
        const cert = path.join(RED.settings.userDir, 'certs');
        const shc = new BoschSmartHomeBridge(req.query.shcip, req.query.clientid, cert, new ShcLogger());

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
            password: {type: 'password'}
        }
    });
};
