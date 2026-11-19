import "dotenv/config";

/**
 * Runtime configuration.
 *
 * MODE controls which transport layer the wallet talks to:
 *  - "sim"   : in-memory bitcoin + lightning simulation (zero dependencies, no Docker).
 *              Real keys, real signed transactions, simulated network. Used for tests and
 *              the instant `npm start` demo on the happy path.
 *  - "docker": real bitcoind (regtest) + LND, wired through docker-compose.
 *              The exact same code paths run, only the Chain/Lightning adapters differ.
 */
export type RunMode = "sim" | "docker";

function mode(): RunMode {
  const m = (process.env.MODE || process.env.TERANGA_MODE || "sim").toLowerCase();
  return m === "docker" ? "docker" : "sim";
}

export interface AppConfig {
  mode: RunMode;
  port: number;
  // Bitcoin
  regtest: boolean;
  feeRateSatPerVbyte: number;
  // Lightning (docker/LND mode)
  lndRestHost: string;
  lndMacaroonPath: string;
  lndCertPath: string;
  // Nostr
  nostrRelays: string[];
  // Demo fixture
  seedDemo: boolean;
  demoWalletName: string;
}

export const config: AppConfig = {
  mode: mode(),
  port: Number(process.env.PORT || 3000),
  regtest: true,
  feeRateSatPerVbyte: Number(process.env.FEE_RATE || 1),
  lndRestHost: process.env.LND_REST_HOST || "https://lnd:8080",
  lndMacaroonPath: process.env.LND_MACAROON_PATH || "/data/admin.macaroon",
  lndCertPath: process.env.LND_CERT_PATH || "/data/tls.cert",
  nostrRelays: (process.env.NOSTR_RELAYS || "ws://localhost:8086").split(",").map((s) => s.trim()),
  seedDemo: (process.env.SEED_DEMO || "true") !== "false",
  demoWalletName: process.env.DEMO_WALLET_NAME || "Awa (demo)",
};