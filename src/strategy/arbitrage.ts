import { ClobClient, OrderType, Side } from "@polymarket/clob-client";
import type { AppConfig } from "../types";
import Big from 'big.js';
type Trend = "UPTREND" | "DOWNTREND" | "NEUTRAL";
type PositionSide = "yes" | "no";

interface GammaMarket {
  slug?: string;
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
  endDate?: string;
  outcomes?: string | string[];
  clobTokenIds?: string | string[];
}

interface MarketBinding {
  symbol: string;
  timeframe: string;
  slug: string;
  yesTokenId: string;
  noTokenId: string;
}

interface OrderLevel {
  price: string;
  size: string;
}

interface OrderBookResponse {
  bids?: OrderLevel[];
  asks?: OrderLevel[];
}

interface BotPosition {
  side: PositionSide;
  tokenId: string;
  size: number;
}

const localPositions = new Map<string, BotPosition>();

function keyOf(market: { symbol: string; timeframe: string }): string {
  return `${market.symbol}:${market.timeframe}`;
}

function parseArrayField(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((v) => String(v));
  } catch {
    return [];
  }
  return [];
}

function parseOutcomeTokens(m: GammaMarket): { yesTokenId: string; noTokenId: string } | null {
  const outcomes = parseArrayField(m.outcomes).map((x) => x.toLowerCase());
  const tokenIds = parseArrayField(m.clobTokenIds);
  if (outcomes.length < 2 || tokenIds.length < 2) return null;
  const yesIdx = outcomes.indexOf("yes");
  const noIdx = outcomes.indexOf("no");
  if (yesIdx < 0 || noIdx < 0) return null;
  return { yesTokenId: tokenIds[yesIdx], noTokenId: tokenIds[noIdx] };
}

function computeBidDepth(book: OrderBookResponse, levels: number): number {
  const bids = book.bids ?? [];
  return bids.slice(0, levels).reduce((sum, level) => sum + Number(level.size ?? 0), 0);
}

function bestAsk(book: OrderBookResponse): number {
  return Number(book.asks?.[0]?.price ?? 0);
}

function bestBid(book: OrderBookResponse): number {
  return Number(book.bids?.[0]?.price ?? 0);
}

function computeTrend(yesBidDepth: number, noBidDepth: number, threshold: number): { trend: Trend; obi: number } {
  const denom = yesBidDepth + noBidDepth;
  if (denom <= 0) return { trend: "NEUTRAL", obi: 0 };
  const obi = (yesBidDepth - noBidDepth) / denom;
  if (obi > threshold) return { trend: "UPTREND", obi };
  if (obi < -threshold) return { trend: "DOWNTREND", obi };
  return { trend: "NEUTRAL", obi };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return (await res.json()) as T;
}

async function discoverMarket(
  config: AppConfig,
  symbol: string,
  timeframe: string
): Promise<MarketBinding | null> {
  const list = await fetchJson<GammaMarket[]>(`${config.gammaApiUrl}/markets?active=true&closed=false&limit=500`);
  const now = Date.now();
  const target = `${symbol}-updown-${timeframe}`;
  const candidate = list
    .filter((m) => {
      const slug = (m.slug ?? "").toLowerCase();
      if (!slug.includes(target)) return false;
      if (m.archived || m.closed || m.active === false) return false;
      const endMs = m.endDate ? new Date(m.endDate).getTime() : Number.MAX_SAFE_INTEGER;
      return endMs > now;
    })
    .sort((a, b) => {
      const ae = a.endDate ? new Date(a.endDate).getTime() : Number.MAX_SAFE_INTEGER;
      const be = b.endDate ? new Date(b.endDate).getTime() : Number.MAX_SAFE_INTEGER;
      return ae - be;
    })[0];

  if (!candidate?.slug) return null;
  const tokenIds = parseOutcomeTokens(candidate);
  if (!tokenIds) return null;
  return {
    symbol,
    timeframe,
    slug: candidate.slug,
    yesTokenId: tokenIds.yesTokenId,
    noTokenId: tokenIds.noTokenId,
  };
}

async function buyToken(
  client: ClobClient | null,
  tokenId: string,
  amountUsd: number,
  simulation: boolean
): Promise<void> {
  if (simulation) return;
  if (!client) throw new Error("Client missing");
  const tickSize = await client.getTickSize(tokenId);
  const negRisk = await client.getNegRisk(tokenId);
  await client.createAndPostMarketOrder(
    { tokenID: tokenId, amount: new Big(amountUsd).toString(), side: Side.BUY, orderType: OrderType.FOK },
    { tickSize, negRisk },
    OrderType.FOK
  );
}

async function sellToken(
  client: ClobClient | null,
  tokenId: string,
  sizeShares: number,
  simulation: boolean
): Promise<void> {
  if (simulation) return;
  if (!client) throw new Error("Client missing");
  const tickSize = await client.getTickSize(tokenId);
  const negRisk = await client.getNegRisk(tokenId);
  await client.createAndPostMarketOrder(
    { tokenID: tokenId, amount: sizeShares, side: Side.SELL, orderType: OrderType.FOK },
    { tickSize, negRisk },
    OrderType.FOK
  );
}

async function buyAndStorePosition(args: {
  client: ClobClient | null;
  stateKey: string;
  side: PositionSide;
  tokenId: string;
  askPrice: number;
  orderUsd: number;
  simulation: boolean;
}): Promise<void> {
  await buyToken(args.client, args.tokenId, args.orderUsd, args.simulation);
  localPositions.set(args.stateKey, {
    side: args.side,
    tokenId: args.tokenId,
    size: args.orderUsd / args.askPrice,
  });
}

export async function runObiArbitrage(client: ClobClient | null, config: AppConfig): Promise<void> {
  const markets = config.arbitrage.markets;
  if (!markets.length) {
    throw new Error("No arbitrage markets configured. Set ARBITRAGE_MARKETS in .env (example: btc:5m,btc:15m).");
  }
  console.log(`Arbitrage strategy started | ${config.simulationMode ? "SIM" : "LIVE"} | ${markets.map((m) => `${m.symbol}:${m.timeframe}`).join(", ")}`);

  async function tick() {
    for (const target of markets) {
      try {
        const binding = await discoverMarket(config, target.symbol, target.timeframe);
        if (!binding) {
          console.log(`[${keyOf(target)}] market not found`);
          continue;
        }
        const yesBook = await fetchJson<OrderBookResponse>(`${config.clobHost}/book?token_id=${binding.yesTokenId}`);
        const noBook = await fetchJson<OrderBookResponse>(`${config.clobHost}/book?token_id=${binding.noTokenId}`);

        const yesBidDepth = computeBidDepth(yesBook, config.arbitrage.obiDepthLevels);
        const noBidDepth = computeBidDepth(noBook, config.arbitrage.obiDepthLevels);
        const { trend, obi } = computeTrend(yesBidDepth, noBidDepth, config.arbitrage.trendThreshold);
        const yesAsk = bestAsk(yesBook);
        const noAsk = bestAsk(noBook);
        const yesBid = bestBid(yesBook);
        const noBid = bestBid(noBook);
        const stateKey = keyOf(target);
        const pos = localPositions.get(stateKey);

        const header = `[${stateKey}] ${binding.slug} | trend=${trend} obi=${obi.toFixed(4)} | yes(${yesBidDepth.toFixed(2)}) no(${noBidDepth.toFixed(2)})`;
        if (!pos) {
          if (trend === "UPTREND" && yesAsk > 0) {
            await buyAndStorePosition({
              client,
              stateKey,
              side: "yes",
              tokenId: binding.yesTokenId,
              askPrice: yesAsk,
              orderUsd: config.arbitrage.orderUsd,
              simulation: config.simulationMode,
            });
            console.log(`${header} | ACTION=BUY_YES`);
          } else if (trend === "DOWNTREND" && noAsk > 0) {
            await buyAndStorePosition({
              client,
              stateKey,
              side: "no",
              tokenId: binding.noTokenId,
              askPrice: noAsk,
              orderUsd: config.arbitrage.orderUsd,
              simulation: config.simulationMode,
            });
            console.log(`${header} | ACTION=BUY_NO`);
          } else {
            console.log(`${header} | ACTION=WAIT`);
          }
          continue;
        }

        if (trend === "NEUTRAL") {
          await sellToken(client, pos.tokenId, pos.size, config.simulationMode);
          localPositions.delete(stateKey);
          console.log(`${header} | ACTION=SELL_${pos.side.toUpperCase()}_ON_NEUTRAL`);
          continue;
        }

        if (trend === "UPTREND") {
          if (pos.side === "yes") {
            console.log(`${header} | ACTION=WAIT_HOLD_YES`);
          } else {
            await sellToken(client, pos.tokenId, pos.size, config.simulationMode);
            if (yesAsk > 0) {
              await buyAndStorePosition({
                client,
                stateKey,
                side: "yes",
                tokenId: binding.yesTokenId,
                askPrice: yesAsk,
                orderUsd: config.arbitrage.orderUsd,
                simulation: config.simulationMode,
              });
              console.log(`${header} | ACTION=SELL_NO_AND_BUY_YES_ON_UPTREND`);
            } else {
              localPositions.delete(stateKey);
              console.log(`${header} | ACTION=SELL_NO_ON_UPTREND`);
            }
          }
          continue;
        }

        if (trend === "DOWNTREND") {
          if (pos.side === "no") {
            console.log(`${header} | ACTION=WAIT_HOLD_NO`);
          } else {
            await sellToken(client, pos.tokenId, pos.size, config.simulationMode);
            if (noAsk > 0) {
              await buyAndStorePosition({
                client,
                stateKey,
                side: "no",
                tokenId: binding.noTokenId,
                askPrice: noAsk,
                orderUsd: config.arbitrage.orderUsd,
                simulation: config.simulationMode,
              });
              console.log(`${header} | ACTION=SELL_YES_AND_BUY_NO_ON_DOWNTREND`);
            } else {
              localPositions.delete(stateKey);
              console.log(`${header} | ACTION=SELL_YES_ON_DOWNTREND`);
            }
          }
          continue;
        }

        console.log(`${header} | ACTION=WAIT`);
        void yesBid;
        void noBid;
      } catch (e) {
        console.error(`[${keyOf(target)}]`, (e as Error)?.message ?? e);
      }
    }
  }

  await tick();
  setInterval(() => {
    tick().catch((e) => console.error("tick", (e as Error)?.message ?? e));
  }, Math.max(1000, config.arbitrage.checkIntervalMs));
}
