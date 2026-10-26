// End-to-end run on GenLayer Studionet:  npm install && npm run lifecycle:studionet
// Deploys contract.py, submits claims, checks them through validator consensus
// and writes every tx hash and the final state to deployments/studionet.json.
// Signs with a throwaway key (DEPLOYER_PRIVATE_KEY env var or a fresh one).

import fs from "node:fs";
import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { describeReceipt } from "./tx.js";

const WAIT = { status: "FINALIZED", retries: 200, interval: 3000 };
const user = createAccount(process.env.DEPLOYER_PRIVATE_KEY || generatePrivateKey());
const client = createClient({ chain: studionet });
const log = [];
const json = (v) => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)));

async function step(label, fn, expectOk = true) {
  process.stdout.write(`- ${label} ... `);
  const hash = await fn();
  const receipt = await client.waitForTransactionReceipt({ hash, ...WAIT });
  const d = describeReceipt(receipt);
  log.push({ label, hash, status: d.status, consensus: d.consensus, execution: d.execution,
    ok: d.ok, expected_ok: expectOk, return_value: d.returnValue ?? null, error: d.error });
  console.log(d.ok ? `OK ${d.consensus} ${d.returnValue ?? ""}` : `FAILED (${d.error})`);
  if (d.ok !== expectOk) throw new Error(`Unexpected outcome for "${label}"`);
  return receipt;
}
const write = (address, functionName, args) => () =>
  client.writeContract({ account: user, address, functionName, args, value: 0n });

const code = fs.readFileSync(new URL("../contract.py", import.meta.url), "utf8");
const dep = await step("deploy contract", () => client.deployContract({ account: user, code, args: [] }));
const address = dep.data?.contract_address ?? dep.recipient ?? dep.to_address;
console.log(`  contract: ${address}`);

const BTC = "https://en.wikipedia.org/api/rest_v1/page/summary/Bitcoin";
const ETH = "https://en.wikipedia.org/api/rest_v1/page/summary/Ethereum";

await step("submit_claim #0 (true claim)", write(address, "submit_claim", [
  "Bitcoin began to be used as a currency in 2009.", BTC, ""]));
await step("check_claim #0", write(address, "check_claim", [0]));
await step("check_claim #0 again (must fail: final)", write(address, "check_claim", [0]), false);

await step("submit_claim #1 (false claim)", write(address, "submit_claim", [
  "The Bitcoin white paper was published in 2011.", BTC, ""]));
await step("check_claim #1", write(address, "check_claim", [1]));

await step("submit_claim #2 (evidence silent)", write(address, "submit_claim", [
  "Bitcoin's creator lives in Tokyo.", ETH, BTC]));
await step("check_claim #2", write(address, "check_claim", [2]));

const claims = [];
for (const id of [0, 1, 2]) claims.push(json(await client.readContract({ address, functionName: "get_claim", args: [id] })));

fs.writeFileSync(new URL("../deployments/studionet.json", import.meta.url), JSON.stringify({
  network: "studionet", rpc: studionet.rpcUrls.default.http[0], contract: address,
  generated_at: new Date().toISOString(), transactions: log, final_state: claims }, null, 2));
for (const c of claims) console.log(`  #${c.id} ${c.verdict}  quote: ${c.quote}`);
