import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createWallet,
  recoverWallet,
  deriveKey,
  firstReceiveAddress,
  buildSignedTx,
  signP2wpkh,
} from "../src/bitcoin/wallet.js";
import { RegtestChain } from "../src/bitcoin/chain.js";

test("createWallet produces a 12-word mnemonic and a regtest bech32 address", () => {
  const w = createWallet("Awa");
  assert.equal(w.mnemonic!.split(" ").length, 12);
  const addr = firstReceiveAddress(w.root);
  assert.match(addr, /^bcrt1/);
});

test("recoverWallet rebuilds the same wallet from the mnemonic", () => {
  const w = createWallet("Awa");
  const recovered = recoverWallet("Awa", w.mnemonic!);
  assert.equal(firstReceiveAddress(recovered.root), firstReceiveAddress(w.root));
});

test("buildSignedTx signs a real P2WPKH spend and the chain settles it", async () => {
  const chain = new RegtestChain();
  const w = createWallet("Awa");
  const src = firstReceiveAddress(w.root); // index 0 receive
  await chain.fund(src, 100_000, 6);

  const utxos = await chain.getUtxos(src);
  assert.equal(utxos.length, 1);
  assert.equal(utxos[0].valueSat, 100_000);

  const dest = deriveKey(w.root, 1, false).address;
  const change = deriveKey(w.root, 0, true).address;

  const result = buildSignedTx({
    utxos,
    toAddress: dest,
    amountSat: 30_000,
    feeRateSatPerVbyte: 1,
    changeAddress: change,
    resolveInput: (address) => {
      if (address !== src) throw new Error("unexpected input");
      return { sign: (psbt, i) => signP2wpkh(psbt, i, deriveKey(w.root, 0, false).privateKey) };
    },
  });

  assert.ok(result.rawHex.length > 100);
  assert.ok(result.feeSat > 0);

  const txid = await chain.broadcast(result.rawHex);
  assert.equal(txid, result.txid);

  assert.equal(await chain.getBalanceSat(dest), 30_000);
  assert.equal(await chain.getBalanceSat(change), 100_000 - 30_000 - result.feeSat);
});