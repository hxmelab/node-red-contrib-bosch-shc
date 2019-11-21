"use strict";

const path                      = require('path');
const {BoschSmartHomeBridge}    = require('bosch-smart-home-bridge');
const ShcLogger                 = require('./shc-logger');
const mdns                      = require('node-dns-sd');
const mkdir                     = require('mkdirp-sync');


module.exports = function (RED) {

    class ShcConfigNode {
        constructor(config) {

            RED.nodes.createNode(this, config);
            this.shcid =        config.shcid;
            this.host =         config.host;
            this.clientid =     config.clientid;
            this.clientname =   config.clientname;
            this.pollid =       config.pollid;
            this.path =         config.path;
            this.password =     this.credentials.password;
    


            let caDev = path.join(RED.settings.userDir, "certs");

            mkdir(caDev);


            //this.shc = new BoschSmartHomeBridge('192.168.0.10', 'client-id', caDev, new ShcLogger());
            //this.shc.pairIfNeeded('client-name', 'password');

            this.pollid = '';

            //this.poll();
    
            //this.on('close', this.destructor);
            
        }

        destructor(done) {
            this.unsubscribe().then(done);
        }

        

        subscribe() {
            this.shc.getBshcClient().subscribe('').subscribe(result => {
                this.pollid = result.result;
                
                console.log(this.pollid);
                this.poll();
            });
        };

        poll() {
            console.log('poll', this.pollid)
            if (this.pollid.length > 0) {
                this.shc.getBshcClient().longPolling('', this.pollid).subscribe(data => {
                    if (data.error) {
                        // do some handling
                    } else {
                        console.log(data.result);
                        this.emit('shc-events', data.result);
                    }
                    this.poll();
                });
            } else {
                this.subscribe();
            }
        };

        unsubscribe() {
            return new Promise((resolve, reject) => {
                if (this.pollid.length > 0) {
                    this.shc.getBshcClient().unsubscribe('', this.pollid).subscribe(() => {
                        console.log("unsubscribe: " + this.pollid);
                        resolve();
                    });
                } else {
                    reject(new Error('no subscription'));
                }
            });
        }


    }


    /**
     * Create webhook for generating an identifier
     */
    RED.httpAdmin.get('/shc/id', (req, result) => {
        result.set({'content-type': 'application/json; charset=utf-8'});
        result.end(JSON.stringify('node-red-contrib-bosch-shc-' + ('0000000000' + Math.floor(Math.random() * 10000000000)).slice(-10)));
        return;
    });   

    /**
     * Create webhook for discovering SHCs in local network
     */
    RED.httpAdmin.get('/shc/discover', (req, result) => {
        mdns.discover({name: '_http._tcp.local'}).then((res) => {
            var filterList = [];
            res.forEach(function(element) {
                if (element.hasOwnProperty('fqdn') && element.fqdn.indexOf('Bosch SHC') !== -1) {                
                    filterList.push(element);
                }
            });
            result.set({'content-type': 'application/json; charset=utf-8'});
            result.end(JSON.stringify(filterList));
        }).catch((err) => {
            new Error(err);
        });
        return;
    });


    RED.nodes.registerType('shc-config', ShcConfigNode, {
        credentials: {
            password: {type: 'password'}
        }
    });
};
