# Bosch Smart Home Controller (SHC) nodes for Node-Red

This module provides several nodes for interacting with Bosch Smart Home services and edge devices via the local controller API. A full documentation of the API can be found [here](https://apidocs.bosch-smarthome.com/local/).


### Release info

With the update to v0.1.7 or higher, the configuration of the SHC must be created again if you have created SHC configurations with version v0.0.6 or earlier. Therefore, please delete old SHC configurations first and recreate them after the update. 

The reason for this is a change of the certificate handling. As of v0.1.7, the certificates are stored in Node-RED. This makes the whole thing more secure if Node-RED itself is properly secured. After the update you can delete the directory "/certs" in "~/.node-red". 

If you encounter any problem, do not hesitate to create an issue.


### Features

- Local network discovery of the SHC
- Pairing with SHC
- Event polling (long polling)
- Get all services from devices
- Get and set states of devices
- Trigger scenarios


## Device Node

Events are received via long polling from the SHC as soon as any state of a service changes. Each device has several services. A device node either sends the service as a JSON object or a single state, if configured [https://github.com/hxmelab/node-red-contrib-bosch-shc/tree/4_FixClientCert#get-a-state](this way).

![Device node](docs/device_node.png)


### Get all services of a device

It is also possible to send all related services of a device. Therefore, select a **Device** and select **all** as a **Service**. The **State** input field can be left empty.

![All services](docs/device_conf_all.png)


### Get a specific service of a device

Select a **Service** to send only objects of the specified service. As soon as any state of this service changes, the node sends a **msg** object that contains the new state. An **ENTITY_NOT_FOUND** error message is sent from the node if the service does not exist or is not related to the device. 

![Specific service](docs/device_conf_service.png)


### Get a state

To send only a value instead of the entire service object, enter the name of the **State** in the corresponding field. The **service object** is sent from the node if the state does not exist.

![State of a service](docs/device_conf_state.png)

To request a service of a device any **msg** can be used. The device node overwrites **msg.topic** and **msg.payload** with the defined state, service, or all services as array if 'all' is selected and sends the **msg**.

![Request a device](docs/device_node_request.png)

### Set a state
However, if the **msg.payload** matches the predefined **type** and **range** of the **service**, the associated state will be updated with the specified payload value. The following services can be updated:

| Service                             | Payload Type | Payload Range | Information |
|-------------------------------------|--------------|---------------|-------------|
| **IntrusionDetectionControl**       | boolean      | true, false    | Activate/deactivate alarm system |
| **PresenceSimulationConfiguration** | boolean      | true, false    | Activate/deactivate presence simulation |
| **SmokeDetectorCheck**              | boolean      | true, false    | Triggers a test alarm on this device |
| **PowerSwitch**                     | boolean      | true, false    | Turn device on/off |
| **PrivacyMode**                     | boolean      | true, false    | Activate/deactivate camera privacy mode |
| **RoomClimateControl**                  | Number       | 5.0, 5.5, ..., 29.5, 30.0       | Set a room temperature |
| **ShutterControl**                  | Number       | 0.000, 0.005, ..., 0.995, 1.000 | Set the level of a shutter |


## Scenario Node

Use this node to trigger the scenario defined in this node. Each **msg** can be used as a trigger.

![Scenario node](docs/scenario_node.png)


## Faults Node

This node sends all events containing the **faults**-key. These messages usually refer to low-battery events of battery-powered edge devices.

![Faults node](docs/faults_node.png)

By activating the **Debug** check box, this node sends all messages that are received by the SHC via long polling. 
