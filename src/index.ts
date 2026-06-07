import { loadConfig } from "./config";
import { createClient, validateUsdcBalance, validateWalletBinding } from "./config/client";
import { runObiArbitrage } from "./strategy/arbitrage";

async function run() {
  const config = loadConfig();
  if (!config.arbitrage.markets.length) {
    console.error("No markets. Set ARBITRAGE_MARKETS in .env (example: btc:5m,btc:15m)");
    process.exit(1);
  }
  if (!config.walletPrivateKey) {
    console.error("No wallet. Set WALLET_PRIVATE_KEY in .env");
    process.exit(1);
  }
  if (!config.proxyWalletAddress && config.signatureType !== 0) {
    console.error("Set PROXY_WALLET_ADDRESS in .env for proxy/Magic wallet");
    process.exit(1);
  }
  try {
    await validateWalletBinding(config);
      await validateUsdcBalance(config);
    console.log(`Wallet validation passed for SIGNATURE_TYPE=${config.signatureType}`);
  } catch (error) {
    console.error((error as Error)?.message ?? error);
    process.exit(1);
  }

  const client = config.simulationMode ? null : await createClient(config);
  await runObiArbitrage(client, config);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
