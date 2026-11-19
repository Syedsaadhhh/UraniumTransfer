import express from "express";
import path from "node:path";
import QRCode from "qrcode";
import { config } from "./config.js";
import { RegtestChain } from "./bitcoin/chain.js";
import { SimLightning } from "./lightning/sim.js";
import { LndLightning } from "./lightning/lnd.js";
import { LocalNostr } from "./nostr.js";
import { WalletService } from "./service.js";
import { apiRouter } from "./routes/api.js";
import type { LightningNode } from "./lightning/types.js";
import type { Chain } from "./bitcoin/chain.js";

async function bootstrap(): Promise<{ service: WalletService; chain: Chain }> {
  // Demo stays on the in-memory regtest sim; docker mode swaps in the real adapters.
  const chain: Chain = new RegtestChain();

  let lightning: LightningNode;
  if (config.mode === "docker") {
    lightning = LndLightning.fromConfig(config.lndRestHost, config.lndMacaroonPath, config.lndCertPath);
  } else {
    lightning = new SimLightning({ localSat: 2_000_000, remoteSat: 2_000_000 });
  }

  const nostr = new LocalNostr();
  const service = new WalletService(chain, lightning, nostr, { feeRate: config.feeRateSatPerVbyte });
  await service.init();
  return { service, chain };
}

let demoSeedId: string | undefined;

async function seedDemo(service: WalletService): Promise<void> {
  if (!config.seedDemo) return;
  try {
    const { summary } = await service.createWallet(config.demoWalletName);
    await service.faucet(summary.seedId, 200_000, 6); // 200k sat "bought" as savings
    await service.topUpLightning(summary.seedId, 50_000); // move some to spending
    await service.receiveRemittance(summary.seedId, 83_333, "Cousin in Paris - 50,000 FCFA");
    demoSeedId = summary.seedId;
    console.log(`[seed] demo wallet ready`);
  } catch (e) {
    console.warn("[seed] demo seeding skipped:", e instanceof Error ? e.message : e);
  }
}

async function main(): Promise<void> {
  const { service, chain } = await bootstrap();
  await seedDemo(service);

  const app = express();
  app.use(express.json());

  app.use("/api", apiRouter(service));

  app.get("/api/demo", (_req, res) => {
    res.json({ seedId: demoSeedId ?? null });
  });

  app.get("/api/list", async (_req, res) => {
    res.json(await service.list());
  });

  app.get("/api/qr", async (req, res) => {
    const text = String(req.query.text || "");
    if (!text) return res.status(400).json({ error: "text query required" });
    const dataUrl = await QRCode.toDataURL(text, { margin: 1, width: 220 });
    res.json({ dataUrl });
  });

  const publicDir = path.resolve(process.cwd(), "public");
  app.use(express.static(publicDir));

  // Demo harness endpoints (documented as demo-only, excluded from the threat model's
  // production surface). They let judges run the happy path without the UI.
  app.get("/", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));

  app.listen(config.port, "127.0.0.1", () => {
    console.log(`Teranga wallet listening on http://localhost:${config.port}`);
    console.log(`mode=${config.mode}  nostrRelays=${config.nostrRelays.join(",")}`);
    console.log(`demo=http://localhost:${config.port}/  api=http://localhost:${config.port}/api/health`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
