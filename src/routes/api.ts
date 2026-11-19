import { Router, type Request, type Response } from "express";
import type { WalletService } from "../service.js";

function err(res: Response, e: unknown): void {
  const message = e instanceof Error ? e.message : String(e);
  res.status(400).json({ error: message });
}

function body<T>(req: Request, res: Response): T | null {
  if (!req.body || typeof req.body !== "object") {
    res.status(400).json({ error: "JSON body required" });
    return null;
  }
  return req.body as T;
}

export function apiRouter(service: WalletService): Router {
  const r = Router();

  r.get("/health", (_req, res) => {
    res.json({ ok: true, mode: process.env.MODE || "sim", time: Date.now() });
  });

  r.post("/wallet", async (req, res) => {
    const b = body<{ name?: string }>(req, res);
    if (!b) return;
    try {
      const { summary, mnemonic } = await service.createWallet(b.name || "My wallet");
      res.status(201).json({ ...summary, mnemonic });
    } catch (e) {
      err(res, e);
    }
  });

  r.post("/wallet/recover", async (req, res) => {
    const b = body<{ name?: string; mnemonic: string }>(req, res);
    if (!b) return;
    try {
      const summary = await service.recoverWallet(b.name || "Recovered wallet", b.mnemonic);
      res.json(summary);
    } catch (e) {
      err(res, e);
    }
  });

  r.get("/wallet/:seedId", async (req, res) => {
    try {
      res.json(await service.summary(req.params.seedId));
    } catch (e) {
      err(res, e);
    }
  });

  r.post("/wallet/:seedId/address", async (req, res) => {
    try {
      res.json({ address: await service.nextAddress(req.params.seedId) });
    } catch (e) {
      err(res, e);
    }
  });

  r.post("/wallet/:seedId/faucet", async (req, res) => {
    const b = body<{ amountSat: number; confirmations?: number }>(req, res);
    if (!b) return;
    try {
      res.json(await service.faucet(req.params.seedId, b.amountSat, b.confirmations ?? 6));
    } catch (e) {
      err(res, e);
    }
  });

  r.post("/wallet/:seedId/onchain/send", async (req, res) => {
    const b = body<{ toAddress: string; amountSat: number }>(req, res);
    if (!b) return;
    try {
      res.json(await service.sendOnchain(req.params.seedId, b.toAddress, b.amountSat));
    } catch (e) {
      err(res, e);
    }
  });

  r.post("/wallet/:seedId/lightning/topup", async (req, res) => {
    const b = body<{ amountSat: number }>(req, res);
    if (!b) return;
    try {
      res.json(await service.topUpLightning(req.params.seedId, b.amountSat));
    } catch (e) {
      err(res, e);
    }
  });

  r.post("/wallet/:seedId/lightning/invoice", async (req, res) => {
    const b = body<{ amountSat?: number; memo?: string }>(req, res);
    if (!b) return;
    try {
      res.json(await service.createInvoice(req.params.seedId, b.amountSat, b.memo || "Teranga invoice"));
    } catch (e) {
      err(res, e);
    }
  });

  r.post("/wallet/:seedId/lightning/pay", async (req, res) => {
    const b = body<{ paymentRequest: string; amountSat?: number }>(req, res);
    if (!b) return;
    try {
      res.json(await service.payLightning(req.params.seedId, b.paymentRequest, b.amountSat));
    } catch (e) {
      err(res, e);
    }
  });

  r.post("/wallet/:seedId/lightning/withdraw", async (req, res) => {
    const b = body<{ amountSat: number }>(req, res);
    if (!b) return;
    try {
      res.json(await service.withdrawOnchain(req.params.seedId, b.amountSat));
    } catch (e) {
      err(res, e);
    }
  });

  r.post("/wallet/:seedId/remittance/receive", async (req, res) => {
    const b = body<{ amountSat: number; memo?: string }>(req, res);
    if (!b) return;
    try {
      res.json(await service.receiveRemittance(req.params.seedId, b.amountSat, b.memo));
    } catch (e) {
      err(res, e);
    }
  });

  r.get("/quote", async (req, res) => {
    const amountFcfa = Number(req.query.amountFcfa || 0);
    res.json(await service.remittanceQuotes(amountFcfa));
  });

  r.get("/quote/:route", async (req, res) => {
    const amountFcfa = Number(req.query.amountFcfa || 0);
    res.json(await service.quote(req.params.route as never, amountFcfa));
  });

  r.post("/analyze", async (req, res) => {
    const b = body<{ text: string; lang?: string }>(req, res);
    if (!b) return;
    res.json(await service.analyze(b.text, (b.lang as never) || "en"));
  });

  r.get("/savings", async (req, res) => {
    const monthlyFcfa = Number(req.query.monthlyFcfa || 0);
    const years = Number(req.query.years || 5);
    const lang = (req.query.lang as string) || "en";
    res.json(await service.savings(monthlyFcfa, years, lang as never));
  });

  return r;
}