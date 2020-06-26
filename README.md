
[![NPM](https://nodei.co/npm/node-red-contrib-bosch-shc.png)](https://nodei.co/npm/node-red-contrib-bosch-shc/)

# Bosch Smart Home Controller (SHC) nodes for Node-Red
[![NPM version](https://badge.fury.io/js/node-red-contrib-bosch-shc.svg)](http://badge.fury.io/js/node-red-contrib-bosch-shc)
[![Downloads](https://img.shields.io/npm/dm/node-red-contrib-bosch-shc.svg)](https://www.npmjs.com/package/node-red-contrib-bosch-shc)
[![Dependencies Status](https://david-dm.org/hxmelab/node-red-contrib-bosch-shc.svg)](https://david-dm.org/hxmelab/node-red-contrib-bosch-shc)
[![Build Status](https://travis-ci.org/hxmelab/node-red-contrib-bosch-shc.svg?branch=master)](https://travis-ci.org/hxmelab/node-red-contrib-bosch-shc)
[![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/xojs/xo)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/hxmelab/node-red-contrib-bosch-shc/blob/master/LICENSE)

This module provides several nodes for interacting with Bosch Smart Home services and edge devices via the local controller API. 

A full documentation of the API can be found [here](https://apidocs.bosch-smarthome.com/local/).

Example flows can be found [here](https://flows.nodered.org/flow/01271a01a6b647b7b7cfda67c332cfbc).

**Compatible with Node-RED version 1.0.0 or higher.**

### Release Notes

Version **0.3.22** allows you to request the device meta data, e.g. the availability status of a device. In addition, it is now possible to request all device services or a specific state across all related devices at once. The result is an array that you can use, for example, to calculate the total power consumption of all smart plugs or the average temperature across all rooms.

Some legacy code has been removed. **If you encounter any problem with your shc-config after the update to version 0.3.22, you will probably need to recreate it to solve this problem.**

With version **0.2.14** the **smart thermostat (TRV)** was introduced and optimizations were implemented that improves the interaction with the **Node-RED dashboard**: 
- **msg.topic** now contains the name of a device, so that several devices can be separated in a **dashboard chart**. You are also free to configure **msg.topic** via the device property **name**.
- The output of **boolean services** has been aligned with the input if the corresponding **state** is set. The Node-RED **dashboard switch** can now be wired directly to boolean services to toggle a switch state, such as for the camera or the smart plug.
- The output for **all** services of a device is no longer an array. Instead each service is send as a separate **msg**.

With the update to version **0.1.7** or higher, the configuration of the SHC must be created again if you have created SHC configurations with version 0.0.6 or earlier. Therefore, please delete old SHC configurations first and recreate them after the update. 

The reason for this is a change of the certificate handling. As of version 0.1.7, the certificates are stored in Node-RED. This makes the whole thing more secure if Node-RED itself is properly secured. After the update you can delete the directory "/certs" in "~/.node-red". 

If you encounter any problem, do not hesitate to create an issue.


### Features

- Local network discovery of the SHC
- Pairing with SHC
- Event polling (long polling)
- Get all services from devices
- Get and set states of devices
- Trigger scenarios


## Device Node

There are two ways to receive data from the SHC, either by [long polling](#long-polling) or by a [request](#requesting). Please note that you should always prefer the long polling mechanism to receive data from the SHC rather than requesting it. However, sometimes it is useful to request a state at a specific time, but you should not do this too often in a short time period, as described [here](https://github.com/BoschSmartHome/bosch-shc-api-docs/tree/master/best_practice#limit-the-number-of-requests-in-a-given-time-period).


### Long Polling

By default events are received via **long polling** from the SHC as soon as any state of a service changes. Each device has several services. A device node sends either the meta data of a device, [all related services of a device](#get-all-services-of-a-device), [a specific service](#get-a-specific-service-of-a-device) or a [single state](#get-a-state).

![Device node](docs/device_node.png)


### Requesting

To request a device any **msg** can be used, if the **msg.payload** does not match the values to [set a state](#set-a-state). The device node overwrites **msg.topic** and **msg.payload** with the selected information as configured in the device node configuration page.

![Request a device](docs/device_node_request.png)


### Get all services of a device

To send all related services of a device, select a **Device** and select **all** as a **Service**. The **State** input field can be left empty. This node sends a message when one of the device services has been updated.

![All services](docs/device_conf_all.png)


### Get a specific service of a device

Select a **Service** to send only JSON objects of the specified service. Requesting the service sends an **ENTITY_NOT_FOUND** error message if the service does not exist or is not related to the device. Via long polling, no **msg** will be sent from the node.

![Specific service](docs/device_conf_service.png)


### Get a state

If you only need a value instead of the entire service object, enter the name of the **State** in the corresponding field. No **msg** is sent from the node if the state does not exist or is not related to the service.

![State of a service](docs/device_conf_state.png)

### Set a state

If the **msg.payload** matches the predefined **type** and **range** of the **service**, the associated state will be updated with the specified payload value. The following services can be updated:

| Service                             | Payload Type | Payload Range | Information |
|-------------------------------------|--------------|---------------|-------------|
| **IntrusionDetectionControl**       | boolean      | true, false    | Activate/deactivate alarm system |
| **PresenceSimulationConfiguration** | boolean      | true, false    | Activate/deactivate presence simulation |
| **SmokeDetectorCheck**              | boolean      | true, false    | Triggers a test alarm on this device |
| **PowerSwitch**                     | boolean      | true, false    | Turn device on/off |
| **PrivacyMode**                     | boolean      | true, false    | Activate/deactivate camera privacy mode |
| **RoomClimateControl**              | number       | 5.0, 5.5, ..., 29.5, 30.0       | Set a room temperature |
| **ShutterControl**                  | number       | 0.000, 0.005, ..., 0.995, 1.000 | Set the level of a shutter (0 = close) |
|                                     | string | stop, close, open | Set the operation state of a shutter (case insensitive) |


## Scenario Node

Use this node to trigger the defined scenario. Each **msg** can be used as a trigger. This node sends a message when the defined scenario has been triggered.

![Scenario node](docs/scenario_node.png)


## Faults Node

This node sends all events containing the **faults** property. These messages usually refer to low-battery events of battery-powered edge devices.

![Faults node](docs/faults_node.png)

By activating the **Debug** check box, this node sends all messages that are received from the SHC via long polling. 
