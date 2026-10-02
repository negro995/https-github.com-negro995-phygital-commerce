// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title PhygitalTwin
/// @notice Soulbound (non-transferable) ERC-1155 Digital Twins. One token id per product; one mint per
///         purchased unit or claimed QR passport. Each mint carries an idempotency reference so that
///         off-chain retries can never double-mint. `twinCount` is the on-chain loyalty signal used for
///         token-gated perks.
contract PhygitalTwin is ERC1155, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    string public name = "Phygital Digital Twin";
    string public symbol = "TWIN";

    /// @notice Total twins ever minted to an address (loyalty score).
    mapping(address => uint256) public twinCount;
    /// @notice Idempotency registry for off-chain mint jobs.
    mapping(bytes32 => bool) public usedMintRefs;

    event TwinMinted(address indexed to, uint256 indexed tokenId, bytes32 indexed mintRef);
    /// @dev ERC-5192 minimal soulbound interface event.
    event Locked(uint256 tokenId);

    error Soulbound();
    error MintRefAlreadyUsed(bytes32 mintRef);
    error InvalidRecipient();

    constructor(string memory uri_, address admin, address minter) ERC1155(uri_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
    }

    function mintTwin(address to, uint256 tokenId, bytes32 mintRef) external onlyRole(MINTER_ROLE) {
        if (to == address(0)) revert InvalidRecipient();
        if (usedMintRefs[mintRef]) revert MintRefAlreadyUsed(mintRef);
        usedMintRefs[mintRef] = true;
        unchecked {
            twinCount[to] += 1;
        }
        _mint(to, tokenId, 1, "");
        emit TwinMinted(to, tokenId, mintRef);
        emit Locked(tokenId);
    }

    /// @notice ERC-5192: every twin is permanently locked to its owner.
    function locked(uint256) external pure returns (bool) {
        return true;
    }

    function setURI(string calldata newUri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(newUri);
    }

    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override {
        if (from != address(0) && to != address(0)) revert Soulbound();
        super._update(from, to, ids, values);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        // 0xb45a3c0e = ERC-5192
        return interfaceId == 0xb45a3c0e || super.supportsInterface(interfaceId);
    }
}
