import type { Address, PublicClient } from "viem";
import { phygitalTwinAbi } from "./abi/phygitalTwin";

export async function readTwinCount(publicClient: PublicClient, contract: Address, owner: Address): Promise<number> {
  const count = await publicClient.readContract({
    address: contract,
    abi: phygitalTwinAbi,
    functionName: "twinCount",
    args: [owner],
  });
  return Number(count);
}
