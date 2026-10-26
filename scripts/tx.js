// Helpers to interpret GenLayer transaction receipts.
// A transaction hash is NOT success: success means the transaction reached
// FINALIZED, consensus agreed, and the contract execution returned normally.

const GOOD_CONSENSUS = new Set(["AGREE", "MAJORITY_AGREE"]);

function leaderReceipt(receipt) {
  const lr = receipt?.consensus_data?.leader_receipt ?? receipt?.consensusData?.leaderReceipt;
  if (Array.isArray(lr)) return lr[0];
  return lr ?? null;
}

function parseLeaderResult(leader) {
  const raw = leader?.result;
  if (raw == null) return { kind: null, readable: null };
  let obj = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return { kind: null, readable: raw };
    }
  }
  return { kind: obj?.status ?? null, readable: obj?.payload?.readable ?? null };
}

export function describeReceipt(receipt) {
  if (!receipt || typeof receipt !== "object") {
    return { ok: false, status: null, execution: null, consensus: null, error: "No receipt returned" };
  }
  const status = receipt.statusName ?? receipt.status_name ?? null;
  const consensus = receipt.resultName ?? receipt.result_name ?? null;
  const leader = leaderReceipt(receipt);
  const parsed = parseLeaderResult(leader);

  let execution = null;
  if (receipt.txExecutionResultName) {
    execution = receipt.txExecutionResultName === "FINISHED_WITH_RETURN" ? "SUCCESS" : receipt.txExecutionResultName;
  } else if (leader?.execution_result) {
    execution = leader.execution_result;
  }

  let error = null;
  if (status !== "FINALIZED") error = `Transaction not finalized (status: ${status ?? "unknown"})`;
  else if (consensus && !GOOD_CONSENSUS.has(consensus)) error = `Consensus failed (${consensus})`;
  else if (execution !== "SUCCESS") {
    error = `Contract execution failed (${execution ?? "result unavailable"})`;
    if (parsed.readable) error += `: ${parsed.readable}`;
  } else if (parsed.kind && parsed.kind !== "return") {
    error = `Contract execution failed: ${parsed.readable ?? parsed.kind}`;
  }

  return { ok: error === null, status, execution, consensus, returnValue: parsed.readable, error };
}

export function assertFinalizedSuccess(receipt) {
  const d = describeReceipt(receipt);
  if (!d.ok) {
    const err = new Error(d.error);
    err.receipt = d;
    throw err;
  }
  return d;
}
