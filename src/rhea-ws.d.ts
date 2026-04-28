declare module 'rhea/lib/ws' {
  export function connect(
    Impl: typeof WebSocket
  ): (url: string, protocols: string | string[], options: unknown) => () => unknown;
}
