// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * PermitAndDeposit — single-transaction USDC deposit helper
 *
 * Turns the standard 2-tx flow (approve + deposit) into 1 tx by using
 * USDC's EIP-2612 permit signature.
 *
 * Agent flow:
 *   1. Sign EIP-712 permit off-chain (gasless)
 *   2. Call depositWithPermit(amount, receiver, deadline, v, r, s) — 1 tx
 *
 * Security:
 *   - msg.sender must be the permit signer (enforced by USDC.permit)
 *   - vault and USDC are immutable — cannot be changed after deployment
 *   - no admin functions, no upgradeability, no stored state
 *   - this contract is a stateless pass-through: USDC flows in and immediately out
 */

interface IERC20Permit {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function approve(address spender, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IVault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
}

contract PermitAndDeposit {
    IERC20Permit public immutable usdc;
    IVault       public immutable vault;

    event PermitDeposit(
        address indexed depositor,
        address indexed receiver,
        uint256 amount,
        uint256 shares
    );

    constructor(address _usdc, address _vault) {
        usdc  = IERC20Permit(_usdc);
        vault = IVault(_vault);
        // Pre-approve vault to pull USDC from this contract.
        // Safe: this contract only holds USDC transiently within depositWithPermit.
        usdc.approve(_vault, type(uint256).max);
    }

    /**
     * @notice Deposit USDC into the yield vault in a single transaction.
     * @dev    Caller (msg.sender) must be the address that signed the permit.
     *         USDC's permit() will revert if the signature doesn't match msg.sender.
     * @param amount   USDC amount in atomic units (6 decimals), e.g. 100_000_000 = $100
     * @param receiver Address that receives the crUSDC vault shares
     * @param deadline Unix timestamp after which permit is invalid
     * @param v        Permit signature component
     * @param r        Permit signature component
     * @param s        Permit signature component
     * @return shares  crUSDC shares minted to receiver
     */
    function depositWithPermit(
        uint256 amount,
        address receiver,
        uint256 deadline,
        uint8   v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 shares) {
        // Step 1: Verify permit and grant this contract allowance from msg.sender
        usdc.permit(msg.sender, address(this), amount, deadline, v, r, s);

        // Step 2: Pull USDC from msg.sender into this contract
        require(usdc.transferFrom(msg.sender, address(this), amount), "USDC transfer failed");

        // Step 3: Deposit into vault — vault pulls from this contract (pre-approved)
        shares = vault.deposit(amount, receiver);

        emit PermitDeposit(msg.sender, receiver, amount, shares);
    }

    /**
     * @notice Preview shares for a given USDC amount (pass-through to vault).
     */
    function previewDeposit(uint256 amount) external view returns (uint256) {
        // Re-use vault's previewDeposit via a staticcall
        (bool ok, bytes memory data) = address(vault).staticcall(
            abi.encodeWithSignature("previewDeposit(uint256)", amount)
        );
        require(ok, "previewDeposit failed");
        return abi.decode(data, (uint256));
    }
}
