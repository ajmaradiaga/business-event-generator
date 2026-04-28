export interface EventConfig {
  id: string;
  type: string;
  source: string;
  topic: string;
  dataFile: string;
  subjectField: string;
  fields: {
    root: string[];
    [navProp: string]: string[];
  };
}

export interface AppConfig {
  events: EventConfig[];
}

export interface BrokerParams {
  url: string;
  vpn: string;
  username: string;
  password: string;
}

export interface EmisServiceKey {
  broker: { type: BrokerType };
  oa2: {
    clientid: string;
    clientsecret: string;
    tokenendpoint: string;
    granttype: string;
  };
  protocol: string[];
  uri: string;
}

export type BrokerType = 'aem' | 'emis';

export interface StreamEntry {
  id: string;
  label: string;
  detail: string;
  topic: string;
  broker: BrokerType;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface CloudEvent {
  specversion: '1.0';
  type: string;
  source: string;
  id: string;
  time: string;
  datacontenttype: 'application/json';
  subject: string;
  data: Record<string, unknown>;
}
