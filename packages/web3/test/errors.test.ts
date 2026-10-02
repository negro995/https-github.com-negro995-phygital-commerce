import { BaseError, ContractFunctionRevertedError, HttpRequestError } from "viem";
import { describe, expect, it } from "vitest";
import { phygitalTwinAbi } from "../src/abi/phygitalTwin";
import { backoffDelayMs, classifyWeb3Error } from "../src/errors";
import { encodeErrorResult } from "viem";

function revert(errorName: "MintRefAlreadyUsed" | "InvalidRecipient", args: readonly unknown[] = []) {
  const data = encodeErrorResult({
    abi: phygitalTwinAbi,
    errorName,
    args: args as never,
  });
  const inner = new ContractFunctionRevertedError({ abi: phygitalTwinAbi, data, functionName: "mintTwin" });
  return new BaseError("Execution reverted", { cause: inner });
}

describe("classifyWeb3Error", () => {
  it("treats MintRefAlreadyUsed as already minted", () => {
    const err = revert("MintRefAlreadyUsed", ["0x" + "11".repeat(32)]);
    expect(classifyWeb3Error(err).kind).toBe("already_minted");
  });

  it("treats other contract reverts as permanent", () => {
    expect(classifyWeb3Error(revert("InvalidRecipient")).kind).toBe("permanent");
  });

  it("treats RPC/network failures as retryable", () => {
    const err = new HttpRequestError({ url: "http://rpc", status: 503, body: {} });
    expect(classifyWeb3Error(err).kind).toBe("retryable");
    expect(classifyWeb3Error(new Error("socket hang up")).kind).toBe("retryable");
  });
});

describe("backoffDelayMs", () => {
  it("grows exponentially and caps", () => {
    const fixed = () => 1;
    expect(backoffDelayMs(1, 1000, 60_000, fixed)).toBe(1000);
    expect(backoffDelayMs(3, 1000, 60_000, fixed)).toBe(4000);
    expect(backoffDelayMs(20, 1000, 60_000, fixed)).toBe(60_000);
  });
  it("applies jitter between 50% and 100%", () => {
    expect(backoffDelayMs(2, 1000, 60_000, () => 0)).toBe(1000);
  });
});
