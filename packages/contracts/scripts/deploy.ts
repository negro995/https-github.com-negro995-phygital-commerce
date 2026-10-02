import fs from "node:fs";
import path from "node:path";
import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No deployer account configured. Set DEPLOYER_PRIVATE_KEY.");
  const minter = process.env.MINTER_ADDRESS || deployer.address;
  const uri = process.env.TWIN_METADATA_URI || "http://localhost:4000/api/twins/{id}.json";

  console.log(`Deploying PhygitalTwin to ${network.name} as ${deployer.address} (minter ${minter})`);
  const twin = await ethers.deployContract("PhygitalTwin", [uri, deployer.address, minter]);
  await twin.waitForDeployment();
  const twinAddress = await twin.getAddress();
  console.log(`PhygitalTwin: ${twinAddress}`);

  let usdcAddress: string | undefined;
  const isLocal = network.name === "localhost" || network.name === "hardhat";
  if (isLocal && process.env.DEPLOY_MOCK_USDC !== "false") {
    const usdc = await ethers.deployContract("MockUSDC");
    await usdc.waitForDeployment();
    usdcAddress = await usdc.getAddress();
    console.log(`MockUSDC: ${usdcAddress}`);
  }

  const { chainId } = await ethers.provider.getNetwork();
  const out = {
    network: network.name,
    chainId: Number(chainId),
    phygitalTwin: twinAddress,
    usdc: usdcAddress ?? null,
    minter,
    deployedAt: new Date().toISOString(),
  };
  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${network.name}.json`), JSON.stringify(out, null, 2));
  console.log(`\nAdd to apps/api/.env:\nTWIN_CONTRACT_ADDRESS=${twinAddress}\nCHAIN_ID=${out.chainId}`);
  if (usdcAddress) console.log(`USDC_TOKEN_ADDRESS=${usdcAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
