import { Contract, providers, utils, Wallet } from "ethers";
import { ClobClient, Chain } from "@polymarket/clob-client";
import { SignatureType } from "@polymarket/order-utils";
import type { AppConfig } from "../types";

interface GammaPublicProfile {
  proxyWallet?: string;
}

const ERC20_ABI = ["function balanceOf(address owner) view returns (uint256)"];
const USDC_BY_CHAIN_ID: Record<number, string> = {
  137: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
};

function getClientSetup(config: AppConfig): {
  clobHost: string;
  chain: Chain;
  wallet: Wallet;
  sigType: SignatureType;
  funder?: string;
} {
  const { clobHost, chainId, walletPrivateKey, proxyWalletAddress, signatureType } = config;
  const chain = chainId === 137 ? Chain.POLYGON : Chain.AMOY;
  const pk = walletPrivateKey.startsWith("0x") ? walletPrivateKey : "0x" + walletPrivateKey;
  const wallet = new Wallet(pk);
  const sigType = signatureType as SignatureType;
  const funder = proxyWalletAddress || undefined;
  return { clobHost, chain, wallet, sigType, funder };
}

export async function validateWalletBinding(config: AppConfig): Promise<void> {
  const { wallet, sigType, funder } = getClientSetup(config);
  if (sigType === 0) {
    return;
  }
  if (!funder) {
    throw new Error("PROXY_WALLET_ADDRESS is required when SIGNATURE_TYPE is 1 or 2.");
  }
  const eoaAddress = wallet.address.toLowerCase();
  const expectedProxy = funder.toLowerCase();
  const url = `${config.gammaApiUrl}/public-profile?address=${eoaAddress}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to validate wallet binding via Gamma public-profile (${res.status})`);
  }
  const profile = (await res.json()) as GammaPublicProfile;
  const actualProxy = (profile.proxyWallet ?? "").toLowerCase();
  if (!actualProxy) {
    throw new Error("Gamma public-profile has no proxyWallet for this PRIVATE_KEY address.");
  }
  if (actualProxy !== expectedProxy) {
    throw new Error(
      `Invalid wallet binding. PRIVATE_KEY resolves to ${eoaAddress} but Gamma proxyWallet is ${actualProxy}, expected ${expectedProxy}.`
    );
  }
}

export async function validateUsdcBalance(config: AppConfig): Promise<void> {
  const { wallet, sigType, funder } = getClientSetup(config);
  const walletToCheck = (sigType === 1 || sigType === 2 ? funder : wallet.address)?.toLowerCase();
  if (!walletToCheck) {
    throw new Error("Cannot validate USDC balance: missing wallet address to check.");
  }

  const usdcAddress = USDC_BY_CHAIN_ID[config.chainId];
  if (!usdcAddress) {
    throw new Error(`USDC validation is not configured for CHAIN_ID=${config.chainId}.`);
  }

  const rpcUrl =
    config.chainId === 137
      ? process.env.POLYGON_RPC_URL ?? "https://polygon-rpc.com"
      : process.env.AMOY_RPC_URL ?? "https://rpc-amoy.polygon.technology";
  const provider = new providers.JsonRpcProvider(rpcUrl);
  const usdc = new Contract(usdcAddress, ERC20_ABI, provider);
  const rawBalance = await usdc.balanceOf(walletToCheck);
  const balance = Number(utils.formatUnits(rawBalance, 6));
  if (Number.isNaN(balance)) {
    throw new Error("Cannot validate USDC balance: failed to parse balance.");
  }
  if (balance < config.arbitrage.orderUsd) {
    throw new Error(
      `Insufficient USDC balance on ${walletToCheck}. Balance=${balance.toFixed(2)} USDC, required >= ${config.arbitrage.orderUsd.toFixed(2)} USDC.`
    );
  }
}

export async function createClient(config: AppConfig): Promise<ClobClient> {
  const { clobHost, chain, wallet, sigType, funder } = getClientSetup(config);
  const tempClient = new ClobClient(clobHost, chain, wallet, undefined, sigType, funder);
  const creds = await tempClient.createOrDeriveApiKey();
  return new ClobClient(clobHost, chain, wallet, creds, sigType, funder);
}
