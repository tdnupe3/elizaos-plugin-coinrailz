declare module 'x402-fetch' {
  export function wrapFetchWithPayment(
    fetchFn: typeof fetch,
    walletClient: any,
    options?: Record<string, any>
  ): typeof fetch;
}
