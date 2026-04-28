# Business Event Generator

[![Built with Claude](https://img.shields.io/badge/Built%20with-Claude-blueviolet)](https://anthropic.com)

A browser-based tool for publishing custom CloudEvents to two broker targets:

- **AEM** – SAP Integration Suite Advanced Event Mesh (Solace AMQP over WebSocket)
- **EMIS** – SAP Integration Suite Event Mesh REST gateway

Events are generated from sample SAP S/4HANA data (Business Partners, etc.) and published as CloudEvents 1.0 messages. Both brokers can publish simultaneously and independently.

## Prerequisites

- Node.js 20+
- npm 10+

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173/business-event-generator/](http://localhost:5173/business-event-generator/).

## Available commands

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server with hot reload |
| `npm run build` | Type-check and build for production (`dist/`) |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |

## Broker configuration

### AEM (Advanced Event Mesh)

Provide the broker connection details in the **AEM Broker** tab:

- **URL** – WebSocket URL, e.g. `wss://host:443`
- **VPN** – Message VPN name
- **Username / Password** – Client credentials

### EMIS (Event Mesh)

Paste the `httprest` service key JSON from SAP BTP into the **EMIS** tab and click **Authenticate**. The service key must contain the `httprest` protocol binding:

```json
{
  "oa2": {
    "clientid": "...",
    "clientsecret": "...",
    "tokenendpoint": "https://<zone>.authentication.<region>.hana.ondemand.com/oauth/token",
    "granttype": "client_credentials"
  },
  "protocol": ["httprest"],
  "broker": { "type": "saprestmgw" },
  "uri": "https://<instance>.<region>.a.eventmesh.integration.cloud.sap:1443"
}
```

## Event configuration

Events and sample data are defined in [`public/events/config.yaml`](public/events/config.yaml) and the accompanying JSON data files under [`public/events/data/`](public/events/data/). Add new event types by extending the config and providing a corresponding data file.
