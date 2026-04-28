declare module 'rhea/lib/ws' {
  // Inner factory returns an opaque connection-details object used by rhea container.connect()
  export function connect(
    Impl: typeof WebSocket
  ): (url: string, protocols: string | string[], options: unknown) => () => unknown;
}
