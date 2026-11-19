import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import { currencies, InputError, object, targetFrom, Transfers, type TestWallet } from "./model.js";
import { LndReceiver } from "./lnd.js";

const web = fileURLToPath(new URL("../../web/", import.meta.url));
const keyPattern = /^[A-Za-z0-9_-]{24}$/;

function key(value: string | undefined, status: number, code: string) {
  if (value == null || !keyPattern.test(value)) throw new InputError(code, status);
  return value;
}

const handler = (fn: (req: Request, res: Response) => unknown) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve().then(() => fn(req, res)).catch(next);
};

export function makeApp(store: Transfers, network?: string) {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set({
      "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
    next();
  });
  app.use("/api", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  app.use("/api", express.json({ limit: "12kb" }));

  // Prototype guardrail, scoped to request creation and node operations; not distributed.
  const limits = new Map<string, { hits: number; until: number }>();
  function limited(scope: string, max: number) {
    return (req: Request, res: Response, next: NextFunction) => {
      const now = Date.now(), bucket = scope + ":" + req.ip;
      if (limits.size > 1000) for (const [k, v] of limits) if (v.until <= now) limits.delete(k);
      const entry = limits.get(bucket);
      if (!entry || entry.until <= now) {
        if (limits.size >= 10_000 && !entry) return res.status(429).json({ error: "rate_limited" });
        limits.set(bucket, { hits: 1, until: now + 60_000 });
      }
      else if (++entry.hits > max) return res.status(429).json({ error: "rate_limited" });
      next();
    };
  }

  const id = (req: Request) => key(req.params.id, 404, "request_not_found");
  app.get("/api/config", (_req, res) => res.json({ mode: store.mode, currencies, network }));
  app.post("/api/requests", limited("create", 20), handler((req, res) => res.status(201).json(store.create(targetFrom(req.body)))));
  app.get("/api/requests/:id", handler((req, res) => res.json(store.view(id(req)))));
  app.post("/api/requests/:id/compare", handler((req, res) => res.json(store.quote(id(req), object(req.body).routes))));
  app.post("/api/requests/:id/quote", limited("quote", 40), handler((req, res) => res.json(store.selectQuote(id(req), object(req.body).quote))));
  app.post("/api/requests/:id/payout-report", limited("report", 20), handler((req, res) => {
    res.json(store.reportPayout(id(req), key(req.get("Authorization")?.replace(/^Bearer /, ""), 403, "not_recipient"), req.body));
  }));
  app.post("/api/requests/:id/invoice", limited("invoice", 25), handler(async (req, res) => {
    res.json(await store.invoice(id(req), key(req.get("Authorization")?.replace(/^Bearer /, ""), 403, "not_recipient"), req.body));
  }));
  app.get("/api/requests/:id/qr", limited("qr", 60), handler(async (req, res) => {
    const row = store.view(id(req));
    if (row.mode !== "testnet" || row.state !== "waiting" || !row.invoice) throw new InputError("no_invoice", 404);
    const qr = await QRCode.toBuffer(row.invoice.paymentRequest.toUpperCase(), { margin: 2, width: 248 });
    res.type("png").send(qr);
  }));
  app.post("/api/requests/:id/refresh", limited("refresh", 120), handler(async (req, res) => {
    res.json(await store.refresh(id(req)));
  }));
  app.post("/api/requests/:id/sandbox-pay", limited("pay", 30), handler((req, res) => {
    res.json(store.paySandbox(id(req), req.get("Authorization")?.replace(/^Bearer /, "") || "", req.body));
  }));
  app.use("/api", (_req, res) => res.status(404).json({ error: "not_found" }));
  app.use(express.static(web));
  app.get("/request", (_req, res) => res.sendFile(web + "index.html"));
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof InputError) return res.status(err.status).json({ error: err.code });
    if (err instanceof SyntaxError && "status" in err) return res.status(400).json({ error: "invalid_input" });
    if (typeof err === "object" && err && "status" in err && err.status === 413) return res.status(413).json({ error: "invalid_input" });
    // Don't log paths, auth headers, invoice strings, or user data returned by the node.
    res.status(503).json({ error: "service_unavailable" });
  });
  return app;
}

async function start() {
  let wallet: TestWallet | undefined;
  const mode = process.env.TRANSFER_MODE || "sandbox";
  if (mode !== "sandbox" && mode !== "lnd") throw new Error("TRANSFER_MODE must be sandbox or lnd");
  if (mode === "lnd") {
    const { TRANSFER_LND_URL: url, TRANSFER_LND_CERT: cert, TRANSFER_LND_MACAROON: macaroon } = process.env;
    if (!url || !cert || !macaroon) throw new Error("LND invoice credentials and HTTPS origin are required");
    wallet = await LndReceiver.open(url, cert, macaroon);
  }
  const store = new Transfers(process.env.TRANSFER_DATA_FILE || `data/transfers-${mode}.json`, wallet);
  const port = Number(process.env.PORT || 3000), host = process.env.HOST || "127.0.0.1";
  makeApp(store, wallet?.network).listen(port, host, () => console.log(`UraniumTransfer (${wallet?.network || "sandbox"}) at http://${host}:${port}`));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  start().catch(e => {
    console.error("UraniumTransfer could not start. Check the data directory, configuration, and test-node credentials.", e?.code || "");
    process.exitCode = 1;
  });
}
