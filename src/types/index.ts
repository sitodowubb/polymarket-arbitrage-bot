export interface AppConfig {
  clobHost: string;
  gammaApiUrl: string;
  chainId: number;
  simulationMode: boolean;
  walletPrivateKey: string;
  proxyWalletAddress: string;
  walletAddress: string;
  signatureType: number;
  arbitrage: {
    markets: Array<{ symbol: string; timeframe: string }>;
    checkIntervalMs: number;
    orderUsd: number;
    obiDepthLevels: number;
    trendThreshold: number;
  };
}
