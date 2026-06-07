import "dotenv/config";
import { Wallet } from "ethers";
import enquirer from "enquirer";
import type { AppConfig } from "../types";
import { DEFAULT_CHAIN_ID, DEFAULT_HOST } from "../constant";

function parseMarkets(raw: string): Array<{ symbol: string; timeframe: string }> {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [symbolRaw, timeframeRaw] = item.split(":");
      return {
        symbol: (symbolRaw ?? "").trim().toLowerCase(),
        timeframe: (timeframeRaw ?? "").trim().toLowerCase(),
      };
    })
    .filter((m) => m.symbol && m.timeframe);
}

export function loadConfig(): AppConfig {
  const walletPrivateKey = (process.env.WALLET_PRIVATE_KEY ?? process.env.PRIVATE_KEY ?? "").trim();
  const proxyWalletAddress = (process.env.PROXY_WALLET_ADDRESS ?? process.env.FUNDER_ADDRESS ?? "").trim();
  const signatureType = parseInt(process.env.SIGNATURE_TYPE ?? "1", 10);

  let walletAddress = "";
  if (walletPrivateKey) {
    const pk = walletPrivateKey.startsWith("0x") ? walletPrivateKey : "0x" + walletPrivateKey;
    try {
      walletAddress = new Wallet(pk).address;
    } catch {
      /* ignore */
    }
    enquirer.verifyConfiguration(walletPrivateKey);
  }

  return {
    clobHost: (process.env.CLOB_API_URL ?? process.env.CLOB_HOST ?? DEFAULT_HOST).trim(),
    gammaApiUrl: (process.env.GAMMA_API_URL ?? "https://gamma-api.polymarket.com").trim(),
    chainId: parseInt(process.env.CHAIN_ID ?? String(DEFAULT_CHAIN_ID), 10),
    simulationMode: (process.env.SIMULATION_MODE ?? process.env.PRODUCTION ?? "false").toLowerCase() !== "true",
    walletPrivateKey,
    proxyWalletAddress,
    walletAddress: proxyWalletAddress || walletAddress,
    signatureType,
    arbitrage: {
      markets: parseMarkets(process.env.ARBITRAGE_MARKETS ?? "btc:5m,btc:15m"),
      checkIntervalMs: parseInt(process.env.ARBITRAGE_CHECK_INTERVAL_MS ?? "5000", 10),
      orderUsd: parseFloat(process.env.ARBITRAGE_ORDER_USD ?? "20"),
      obiDepthLevels: parseInt(process.env.ARBITRAGE_OBI_DEPTH_LEVELS ?? "5", 10),
      trendThreshold: parseFloat(process.env.ARBITRAGE_TREND_THRESHOLD ?? "0.05"),
    },
  };
}
