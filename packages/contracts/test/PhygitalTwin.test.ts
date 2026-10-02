import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

const ref = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

describe("PhygitalTwin", () => {
  async function deploy() {
    const [admin, minter, alice, bob] = await ethers.getSigners();
    const Twin = await ethers.getContractFactory("PhygitalTwin");
    const twin = await Twin.deploy("https://example.com/{id}.json", admin.address, minter.address);
    return { twin, admin, minter, alice, bob };
  }

  it("mints a twin, increments twinCount and emits events", async () => {
    const { twin, minter, alice } = await loadFixture(deploy);
    await expect(twin.connect(minter).mintTwin(alice.address, 7, ref("order-1:item-1")))
      .to.emit(twin, "TwinMinted")
      .withArgs(alice.address, 7, ref("order-1:item-1"));
    expect(await twin.balanceOf(alice.address, 7)).to.equal(1n);
    expect(await twin.twinCount(alice.address)).to.equal(1n);
    expect(await twin.usedMintRefs(ref("order-1:item-1"))).to.equal(true);
  });

  it("is idempotent per mintRef", async () => {
    const { twin, minter, alice } = await loadFixture(deploy);
    await twin.connect(minter).mintTwin(alice.address, 1, ref("dup"));
    await expect(twin.connect(minter).mintTwin(alice.address, 1, ref("dup"))).to.be.revertedWithCustomError(
      twin,
      "MintRefAlreadyUsed",
    );
  });

  it("only allows MINTER_ROLE to mint", async () => {
    const { twin, alice } = await loadFixture(deploy);
    await expect(twin.connect(alice).mintTwin(alice.address, 1, ref("x"))).to.be.revertedWithCustomError(
      twin,
      "AccessControlUnauthorizedAccount",
    );
  });

  it("rejects the zero address", async () => {
    const { twin, minter } = await loadFixture(deploy);
    await expect(twin.connect(minter).mintTwin(ethers.ZeroAddress, 1, ref("z"))).to.be.revertedWithCustomError(
      twin,
      "InvalidRecipient",
    );
  });

  it("is soulbound: transfers and approvals revert", async () => {
    const { twin, minter, alice, bob } = await loadFixture(deploy);
    await twin.connect(minter).mintTwin(alice.address, 3, ref("sb"));
    await expect(
      twin.connect(alice).safeTransferFrom(alice.address, bob.address, 3, 1, "0x"),
    ).to.be.revertedWithCustomError(twin, "Soulbound");
    await expect(twin.connect(alice).setApprovalForAll(bob.address, true)).to.be.revertedWithCustomError(
      twin,
      "Soulbound",
    );
    expect(await twin.locked(3)).to.equal(true);
  });

  it("supports ERC-1155 and ERC-5192 interfaces", async () => {
    const { twin } = await loadFixture(deploy);
    expect(await twin.supportsInterface("0xd9b67a26")).to.equal(true);
    expect(await twin.supportsInterface("0xb45a3c0e")).to.equal(true);
  });

  it("lets the admin update the metadata URI", async () => {
    const { twin, admin, alice } = await loadFixture(deploy);
    await twin.connect(admin).setURI("ipfs://new/{id}.json");
    expect(await twin.uri(1)).to.equal("ipfs://new/{id}.json");
    await expect(twin.connect(alice).setURI("x")).to.be.revertedWithCustomError(
      twin,
      "AccessControlUnauthorizedAccount",
    );
  });
});
