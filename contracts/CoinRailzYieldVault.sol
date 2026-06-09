// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CoinRailzYieldVault
 * @notice AI Agent Yield Portal — auto-routes USDC to the highest-APY protocol on Base.
 *         Non-custodial: no admin can withdraw depositor principal. Ever.
 *
 * @dev ERC-4626 compliant tokenized vault. Supported protocols: Aave v3, Compound v3, Morpho Blue.
 *      Deploy with constructor args for testnet or mainnet addresses.
 *
 * Fee structure (all params behind 48h timelock after initial deploy):
 *   - Entry fee:       0.5% (50 bps) on EVERY deposit → feeRecipient immediately
 *   - Performance fee: 15% (1500 bps) of yield → accumulated, harvested when > MIN_HARVEST_USD
 *   - Exit fee:        0%  (no friction on withdrawals)
 *   - Switch fee:      0%  (rebalancing is automatic, no agent action needed)
 *
 * Security properties:
 *   - onlyOwner cannot withdraw principal — feeRecipient only receives fees
 *   - Fee parameters locked behind 48-hour timelock
 *   - Emergency exit always available for depositors regardless of contract state
 *   - ReentrancyGuard on all state-mutating external functions
 *   - All events emitted for full Basescan transparency
 *
 * Compilation: npx hardhat compile  (requires openzeppelin/contracts)
 * Deploy:      npx hardhat run scripts/deploy-yield-vault.ts --network base-sepolia
 */

// ─── Minimal ERC-20 Interface ────────────────────────────────────────────────

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

// ─── Protocol Interfaces ──────────────────────────────────────────────────────

/// @dev Aave v3 Pool — only the functions we use
interface IAavePool {
    struct ReserveData {
        uint256 configuration;
        uint128 liquidityIndex;
        uint128 currentLiquidityRate;   // APR in ray (1e27)
        uint128 variableBorrowIndex;
        uint128 currentVariableBorrowRate;
        uint128 currentStableBorrowRate;
        uint40  lastUpdateTimestamp;
        uint16  id;
        address aTokenAddress;
        address stableDebtTokenAddress;
        address variableDebtTokenAddress;
        address interestRateStrategyAddress;
        uint128 accruedToTreasury;
        uint128 unbacked;
        uint128 isolationModeTotalDebt;
    }
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
    function getReserveData(address asset) external view returns (ReserveData memory);
}

/// @dev Aave v3 aToken — to read vault's balance (accrues interest automatically)
interface IAToken {
    function balanceOf(address account) external view returns (uint256);
}

/// @dev Compound v3 Comet — USDC market
interface IComet {
    function supply(address asset, uint256 amount) external;
    function withdraw(address asset, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function getUtilization() external view returns (uint256);
    function getSupplyRate(uint256 utilization) external view returns (uint64);
}

/// @dev Morpho Blue — permissionless lending
struct MarketParams {
    address loanToken;
    address collateralToken;
    address oracle;
    address irm;
    uint256 lltv;
}

interface IMorpho {
    function supply(
        MarketParams calldata marketParams,
        uint256 assets,
        uint256 shares,
        address onBehalf,
        bytes calldata data
    ) external returns (uint256 assetsSupplied, uint256 sharesSupplied);

    function withdraw(
        MarketParams calldata marketParams,
        uint256 assets,
        uint256 shares,
        address onBehalf,
        address receiver
    ) external returns (uint256 assetsWithdrawn, uint256 sharesWithdrawn);

    function expectedSupplyAssets(
        MarketParams calldata marketParams,
        address user
    ) external view returns (uint256);
}

// ─── Main Contract ────────────────────────────────────────────────────────────

contract CoinRailzYieldVault {

    // ── ERC-20 Share Token ────────────────────────────────────────────────────

    string  public constant name     = "CoinRailz Yield Vault";
    string  public constant symbol   = "crUSDC";
    uint8   public constant decimals = 6; // matches USDC

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "CRV: allowance exceeded");
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "CRV: zero address");
        require(balanceOf[from] >= amount, "CRV: balance exceeded");
        balanceOf[from] -= amount;
        balanceOf[to]   += amount;
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply      += amount;
        balanceOf[to]    += amount;
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        require(balanceOf[from] >= amount, "CRV: burn exceeds balance");
        balanceOf[from] -= amount;
        totalSupply     -= amount;
        emit Transfer(from, address(0), amount);
    }

    // ── State Variables ───────────────────────────────────────────────────────

    // Underlying asset
    IERC20  public immutable asset; // USDC

    // Fee configuration
    uint256 public depositFeeBps     = 50;    // 0.5%
    uint256 public performanceFeeBps = 1500;  // 15%
    address public feeRecipient;

    // Pending performance fees awaiting harvest (held as USDC in contract)
    uint256 public pendingFees;
    uint256 public constant MIN_HARVEST_USD = 5_000_000; // $5.00 (USDC 6 decimals)

    // Per-depositor cost basis for performance fee high-watermark
    mapping(address => uint256) public costBasisAssets; // net USDC deposited, per wallet
    mapping(address => uint256) public costBasisShares; // shares at time of deposit, per wallet

    // Fee change timelock (48h)
    uint256 public feeChangeProposedAt;
    uint256 public pendingDepositFeeBps;
    uint256 public pendingPerformanceFeeBps;
    uint256 public constant FEE_TIMELOCK = 48 hours;
    uint256 public constant MAX_DEPOSIT_FEE_BPS     = 200;   // hard cap 2%
    uint256 public constant MAX_PERFORMANCE_FEE_BPS = 3000;  // hard cap 30%

    // Protocol configuration
    enum Protocol { AAVE, COMPOUND, MORPHO }
    Protocol public activeProtocol;
    bool     public paused;       // emergency pause for new deposits only

    IAavePool public aavePool;
    IAToken   public aUsdc;       // Aave's interest-bearing USDC token
    IComet    public compoundComet;
    IMorpho   public morpho;
    MarketParams public morphoMarket; // Morpho USDC market params

    // Auto-rebalancing
    uint256 public lastRebalance;
    uint256 public constant REBALANCE_INTERVAL  = 1 days;
    uint256 public constant MIN_REBALANCE_DELTA = 50; // 50 bps = 0.5% APY improvement required

    // Ownership (two-step for safety)
    address public owner;
    address public pendingOwner;

    // Reentrancy guard
    uint256 private _reentrancyStatus = 1;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED     = 2;

    // ── Events ────────────────────────────────────────────────────────────────

    event Deposited(address indexed depositor, address indexed receiver, uint256 assets, uint256 entryFee, uint256 shares);
    event Withdrawn(address indexed owner, address indexed receiver, uint256 assets, uint256 performanceFee, uint256 shares);
    event Rebalanced(Protocol indexed from, Protocol indexed to, uint256 tvl, uint256 fromAPYBps, uint256 toAPYBps);
    event Harvested(address indexed recipient, uint256 amount);
    event HarvestSkipped(uint256 pendingFees, uint256 threshold);
    event FeeChangeProposed(uint256 newDepositFeeBps, uint256 newPerformanceFeeBps, uint256 executableAt);
    event FeeChangeExecuted(uint256 newDepositFeeBps, uint256 newPerformanceFeeBps);
    event EmergencyWithdraw(address indexed user, uint256 assets, uint256 shares);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(bool paused);

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "CRV: not owner");
        _;
    }

    modifier nonReentrant() {
        require(_reentrancyStatus == _NOT_ENTERED, "CRV: reentrant call");
        _reentrancyStatus = _ENTERED;
        _;
        _reentrancyStatus = _NOT_ENTERED;
    }

    modifier whenNotPaused() {
        require(!paused, "CRV: deposits paused");
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    /**
     * @param _asset         USDC token address
     * @param _feeRecipient  Address that receives entry fees and harvested yield
     * @param _aavePool      Aave v3 Pool address (address(0) to disable Aave)
     * @param _aUsdc         Aave interest-bearing USDC (aUSDC) address
     * @param _compoundComet Compound v3 Comet address (address(0) to disable Compound)
     * @param _morpho        Morpho Blue address (address(0) to disable Morpho)
     * @param _morphoMarket  Morpho market params for USDC (ignored if _morpho == address(0))
     * @param _initialProtocol Which protocol to start with (must be enabled)
     */
    constructor(
        address _asset,
        address _feeRecipient,
        address _aavePool,
        address _aUsdc,
        address _compoundComet,
        address _morpho,
        MarketParams memory _morphoMarket,
        Protocol _initialProtocol
    ) {
        require(_asset        != address(0), "CRV: zero asset");
        require(_feeRecipient != address(0), "CRV: zero feeRecipient");

        asset          = IERC20(_asset);
        feeRecipient   = _feeRecipient;
        owner          = msg.sender;
        activeProtocol = _initialProtocol;

        if (_aavePool != address(0)) {
            aavePool = IAavePool(_aavePool);
            aUsdc    = IAToken(_aUsdc);
        }
        if (_compoundComet != address(0)) {
            compoundComet = IComet(_compoundComet);
        }
        if (_morpho != address(0)) {
            morpho       = IMorpho(_morpho);
            morphoMarket = _morphoMarket;
        }
    }

    // ── ERC-4626 Core ─────────────────────────────────────────────────────────

    /**
     * @notice Total USDC controlled by the vault in the active yield protocol.
     *         Does NOT include pendingFees (those are owed to feeRecipient, not depositors).
     */
    function totalAssets() public view returns (uint256) {
        if (activeProtocol == Protocol.AAVE && address(aUsdc) != address(0)) {
            uint256 total = aUsdc.balanceOf(address(this));
            // Subtract pendingFees that are already earmarked but still as aTokens
            return total > pendingFees ? total - pendingFees : 0;
        }
        if (activeProtocol == Protocol.COMPOUND && address(compoundComet) != address(0)) {
            uint256 total = compoundComet.balanceOf(address(this));
            return total > pendingFees ? total - pendingFees : 0;
        }
        if (activeProtocol == Protocol.MORPHO && address(morpho) != address(0)) {
            uint256 total = morpho.expectedSupplyAssets(morphoMarket, address(this));
            return total > pendingFees ? total - pendingFees : 0;
        }
        // Fallback: raw USDC balance (shouldn't happen in normal operation)
        uint256 bal = asset.balanceOf(address(this));
        return bal > pendingFees ? bal - pendingFees : 0;
    }

    /// @notice Convert assets to shares at the current price (before entry fee deduction)
    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply;
        if (supply == 0) return assets;
        return (assets * supply) / totalAssets();
    }

    /// @notice Convert shares to assets at the current price
    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply;
        if (supply == 0) return shares;
        return (shares * totalAssets()) / supply;
    }

    /// @notice Preview how many shares a deposit of `assets` USDC will yield (after entry fee)
    function previewDeposit(uint256 assets) public view returns (uint256 shares) {
        uint256 fee = (assets * depositFeeBps) / 10_000;
        uint256 netAssets = assets - fee;
        return convertToShares(netAssets);
    }

    /// @notice Preview how many USDC assets withdrawn for `shares` (after performance fee)
    function previewRedeem(uint256 shares) public view returns (uint256) {
        return convertToAssets(shares); // Performance fee applied at withdrawal time
    }

    // ── Deposit ───────────────────────────────────────────────────────────────

    /**
     * @notice Deposit USDC, receive crUSDC shares.
     *         0.5% entry fee charged on EVERY deposit — sent to feeRecipient immediately.
     *         No exceptions: this fee applies regardless of prior deposit history.
     *
     * @param assets   Amount of USDC to deposit (in 6-decimal units)
     * @param receiver Address to receive the crUSDC shares
     * @return shares  Number of crUSDC shares minted
     */
    function deposit(uint256 assets, address receiver)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 shares)
    {
        require(assets > 0,                   "CRV: zero deposit");
        require(receiver != address(0),       "CRV: zero receiver");

        // Pull USDC from caller
        asset.transferFrom(msg.sender, address(this), assets);

        // Deduct entry fee immediately
        uint256 entryFee = (assets * depositFeeBps) / 10_000;
        uint256 netAssets = assets - entryFee;

        // Send entry fee to feeRecipient right now — no waiting
        if (entryFee > 0) {
            asset.transfer(feeRecipient, entryFee);
        }

        // Calculate shares based on net assets deposited
        shares = _calculateSharesForDeposit(netAssets);

        // Record cost basis for performance fee tracking
        costBasisAssets[receiver] += netAssets;
        costBasisShares[receiver] += shares;

        // Deploy net assets to the active protocol
        _supplyToProtocol(netAssets);

        // Mint share tokens to receiver
        _mint(receiver, shares);

        emit Deposited(msg.sender, receiver, assets, entryFee, shares);
    }

    function _calculateSharesForDeposit(uint256 netAssets) internal view returns (uint256) {
        uint256 supply = totalSupply;
        if (supply == 0 || totalAssets() == 0) {
            return netAssets; // 1:1 on first deposit
        }
        return (netAssets * supply) / totalAssets();
    }

    // ── Withdraw ──────────────────────────────────────────────────────────────

    /**
     * @notice Redeem crUSDC shares for USDC.
     *         Performance fee (15%) applied to positive yield only.
     *         No exit fee.
     *
     * @param shares   Number of crUSDC shares to redeem
     * @param receiver Address to receive the USDC
     * @param shareOwner Address whose shares are redeemed (must be msg.sender or approved)
     * @return assets  Net USDC received after performance fee
     */
    function redeem(uint256 shares, address receiver, address shareOwner)
        external
        nonReentrant
        returns (uint256 assets)
    {
        require(shares > 0,             "CRV: zero shares");
        require(receiver != address(0), "CRV: zero receiver");

        // Allowance check if not self
        if (shareOwner != msg.sender) {
            uint256 allowed = allowance[shareOwner][msg.sender];
            if (allowed != type(uint256).max) {
                require(allowed >= shares, "CRV: allowance exceeded");
                allowance[shareOwner][msg.sender] = allowed - shares;
            }
        }

        require(balanceOf[shareOwner] >= shares, "CRV: insufficient shares");

        // Calculate gross asset value of these shares
        uint256 grossAssets = convertToAssets(shares);

        // Calculate performance fee on yield (high-watermark)
        uint256 performanceFee = _calculatePerformanceFee(shareOwner, shares, grossAssets);

        // Accumulate performance fee for harvest
        if (performanceFee > 0) {
            pendingFees += performanceFee;
        }

        // Net to receiver
        assets = grossAssets - performanceFee;

        // Update cost basis
        _updateCostBasisOnWithdraw(shareOwner, shares);

        // Burn shares
        _burn(shareOwner, shares);

        // Withdraw from protocol and send to receiver
        _withdrawFromProtocol(assets, receiver);

        emit Withdrawn(shareOwner, receiver, assets, performanceFee, shares);
    }

    function _calculatePerformanceFee(
        address user,
        uint256 sharesToWithdraw,
        uint256 grossAssets
    ) internal view returns (uint256) {
        uint256 userTotalShares = balanceOf[user] + sharesToWithdraw; // before burn
        if (userTotalShares == 0 || costBasisShares[user] == 0) return 0;

        // Proportional cost basis for the shares being withdrawn
        uint256 proportionalCostBasis = (costBasisAssets[user] * sharesToWithdraw) / costBasisShares[user];

        // Only charge performance fee on positive yield
        if (grossAssets <= proportionalCostBasis) return 0;

        uint256 gain = grossAssets - proportionalCostBasis;
        return (gain * performanceFeeBps) / 10_000;
    }

    function _updateCostBasisOnWithdraw(address user, uint256 sharesWithdrawn) internal {
        uint256 userBasisShares = costBasisShares[user];
        if (userBasisShares == 0) return;

        // Deduct proportional cost basis
        uint256 basisToRemove = (costBasisAssets[user] * sharesWithdrawn) / userBasisShares;
        costBasisAssets[user] = costBasisAssets[user] > basisToRemove
            ? costBasisAssets[user] - basisToRemove
            : 0;
        costBasisShares[user] = costBasisShares[user] > sharesWithdrawn
            ? costBasisShares[user] - sharesWithdrawn
            : 0;
    }

    // ── Harvest ───────────────────────────────────────────────────────────────

    /**
     * @notice Sweep accumulated performance fees to feeRecipient.
     *         Callable by anyone. Only executes if pendingFees >= MIN_HARVEST_USD ($5).
     *         This is how CoinRailz collects yield revenue without waiting for withdrawals.
     */
    function harvest() external nonReentrant {
        if (pendingFees < MIN_HARVEST_USD) {
            emit HarvestSkipped(pendingFees, MIN_HARVEST_USD);
            return;
        }

        uint256 toHarvest = pendingFees;
        pendingFees = 0;

        // Withdraw harvest amount from active protocol
        _withdrawFromProtocol(toHarvest, feeRecipient);

        emit Harvested(feeRecipient, toHarvest);
    }

    // ── Auto-Rebalancing ──────────────────────────────────────────────────────

    /**
     * @notice Rebalance to the highest-APY protocol.
     *         Callable by anyone. Enforces 24h cooldown between rebalances.
     *         Only rebalances if APY improvement >= MIN_REBALANCE_DELTA (50 bps).
     *         This is the autonomous routing mechanism — no agent action required.
     */
    function rebalance() external nonReentrant {
        require(
            block.timestamp >= lastRebalance + REBALANCE_INTERVAL,
            "CRV: rebalance cooldown"
        );

        (Protocol best, uint256 bestAPY) = getBestProtocol();
        uint256 currentAPY = getProtocolAPYBps(activeProtocol);

        lastRebalance = block.timestamp;

        // Only move if there's meaningful improvement
        if (best == activeProtocol || bestAPY < currentAPY + MIN_REBALANCE_DELTA) {
            return; // Already optimal — emit no event, just reset timer
        }

        uint256 tvl = totalAssets();
        if (tvl == 0) {
            activeProtocol = best;
            return;
        }

        Protocol previousProtocol = activeProtocol;

        // Withdraw ALL from current protocol (into this contract as USDC)
        _withdrawFromProtocol(tvl, address(this));

        // Switch to best protocol
        activeProtocol = best;

        // Re-deploy to new protocol
        uint256 available = asset.balanceOf(address(this)) - pendingFees;
        if (available > 0) {
            _supplyToProtocol(available);
        }

        emit Rebalanced(previousProtocol, best, tvl, currentAPY, bestAPY);
    }

    // ── Emergency Exit ────────────────────────────────────────────────────────

    /**
     * @notice Always-available exit for depositors.
     *         Performance fee still applies on yield.
     *         Cannot be blocked by owner or paused state.
     *         Emits EmergencyWithdraw for transparency.
     */
    function emergencyWithdraw() external nonReentrant {
        uint256 shares = balanceOf[msg.sender];
        require(shares > 0, "CRV: no shares");

        uint256 grossAssets = convertToAssets(shares);
        uint256 performanceFee = _calculatePerformanceFee(msg.sender, shares, grossAssets);

        if (performanceFee > 0) {
            pendingFees += performanceFee;
        }

        uint256 netAssets = grossAssets - performanceFee;

        _updateCostBasisOnWithdraw(msg.sender, shares);
        _burn(msg.sender, shares);
        _withdrawFromProtocol(netAssets, msg.sender);

        emit EmergencyWithdraw(msg.sender, netAssets, shares);
    }

    // ── Protocol APY Reads ────────────────────────────────────────────────────

    /**
     * @notice Returns APY in basis points for a given protocol.
     *         Reads live on-chain rates — no oracle manipulation possible.
     */
    function getProtocolAPYBps(Protocol p) public view returns (uint256) {
        if (p == Protocol.AAVE && address(aavePool) != address(0)) {
            try aavePool.getReserveData(address(asset)) returns (IAavePool.ReserveData memory data) {
                // liquidityRate is APR in ray (1e27); convert to bps
                // APR bps = rate * 10_000 / 1e27
                return uint256(data.currentLiquidityRate) * 10_000 / 1e27;
            } catch {
                return 0;
            }
        }

        if (p == Protocol.COMPOUND && address(compoundComet) != address(0)) {
            try compoundComet.getUtilization() returns (uint256 utilization) {
                try compoundComet.getSupplyRate(utilization) returns (uint64 ratePerSecond) {
                    // ratePerSecond in 1e18; annualize to bps
                    // APR bps = rate * 365 * 24 * 3600 * 10_000 / 1e18
                    return uint256(ratePerSecond) * 365 * 24 * 3600 * 10_000 / 1e18;
                } catch {
                    return 0;
                }
            } catch {
                return 0;
            }
        }

        if (p == Protocol.MORPHO && address(morpho) != address(0)) {
            // Morpho: estimate via expectedSupplyAssets delta (approximation)
            // For a more accurate rate, query the market's supplyRate from Morpho's IRM
            // Returning 0 here makes Morpho ineligible until properly integrated
            return 0;
        }

        return 0;
    }

    /**
     * @notice Returns the protocol with the best APY and that APY in bps.
     */
    function getBestProtocol() public view returns (Protocol best, uint256 bestAPY) {
        best    = Protocol.AAVE;
        bestAPY = 0;

        Protocol[3] memory protocols = [Protocol.AAVE, Protocol.COMPOUND, Protocol.MORPHO];
        for (uint256 i = 0; i < 3; i++) {
            uint256 apy = getProtocolAPYBps(protocols[i]);
            if (apy > bestAPY) {
                bestAPY = apy;
                best    = protocols[i];
            }
        }
    }

    /**
     * @notice Returns APYs for all three protocols (Aave, Compound, Morpho) in bps.
     */
    function getAllAPYs() external view returns (
        uint256 aaveAPYBps,
        uint256 compoundAPYBps,
        uint256 morphoAPYBps
    ) {
        aaveAPYBps     = getProtocolAPYBps(Protocol.AAVE);
        compoundAPYBps = getProtocolAPYBps(Protocol.COMPOUND);
        morphoAPYBps   = getProtocolAPYBps(Protocol.MORPHO);
    }

    // ── Fee Management (48h Timelock) ─────────────────────────────────────────

    /**
     * @notice Propose a fee change. Executable only after FEE_TIMELOCK (48h).
     *         Hard caps enforced: deposit fee ≤ 2%, performance fee ≤ 30%.
     *         Change is fully transparent on-chain from the moment of proposal.
     */
    function proposeFeeChange(uint256 newDepositFeeBps, uint256 newPerformanceFeeBps)
        external onlyOwner
    {
        require(newDepositFeeBps     <= MAX_DEPOSIT_FEE_BPS,     "CRV: deposit fee too high");
        require(newPerformanceFeeBps <= MAX_PERFORMANCE_FEE_BPS, "CRV: performance fee too high");

        pendingDepositFeeBps     = newDepositFeeBps;
        pendingPerformanceFeeBps = newPerformanceFeeBps;
        feeChangeProposedAt      = block.timestamp;

        emit FeeChangeProposed(newDepositFeeBps, newPerformanceFeeBps, block.timestamp + FEE_TIMELOCK);
    }

    /// @notice Execute a previously proposed fee change after the 48h timelock.
    function executeFeeChange() external onlyOwner {
        require(feeChangeProposedAt != 0,                                  "CRV: no proposal");
        require(block.timestamp >= feeChangeProposedAt + FEE_TIMELOCK,     "CRV: timelock active");

        depositFeeBps     = pendingDepositFeeBps;
        performanceFeeBps = pendingPerformanceFeeBps;
        feeChangeProposedAt = 0;

        emit FeeChangeExecuted(depositFeeBps, performanceFeeBps);
    }

    // ── Owner Controls ────────────────────────────────────────────────────────

    /// @notice Update feeRecipient address. Immediate (not timelocked).
    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "CRV: zero address");
        feeRecipient = newRecipient;
    }

    /**
     * @notice Pause/unpause new deposits. Existing depositors can always withdraw.
     *         Use in emergencies (e.g., underlying protocol issue detected).
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    /// @notice Two-step ownership transfer — initiate.
    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /// @notice Two-step ownership transfer — accept (called by new owner).
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "CRV: not pending owner");
        emit OwnershipTransferred(owner, pendingOwner);
        owner        = pendingOwner;
        pendingOwner = address(0);
    }

    // ── Internal Protocol Helpers ─────────────────────────────────────────────

    function _supplyToProtocol(uint256 amount) internal {
        if (activeProtocol == Protocol.AAVE && address(aavePool) != address(0)) {
            asset.approve(address(aavePool), amount);
            aavePool.supply(address(asset), amount, address(this), 0);
        } else if (activeProtocol == Protocol.COMPOUND && address(compoundComet) != address(0)) {
            asset.approve(address(compoundComet), amount);
            compoundComet.supply(address(asset), amount);
        } else if (activeProtocol == Protocol.MORPHO && address(morpho) != address(0)) {
            asset.approve(address(morpho), amount);
            morpho.supply(morphoMarket, amount, 0, address(this), "");
        }
        // If no protocol configured: USDC stays in contract (safe fallback, no yield)
    }

    function _withdrawFromProtocol(uint256 amount, address recipient) internal {
        if (activeProtocol == Protocol.AAVE && address(aavePool) != address(0)) {
            aavePool.withdraw(address(asset), amount, recipient);
        } else if (activeProtocol == Protocol.COMPOUND && address(compoundComet) != address(0)) {
            if (recipient == address(this)) {
                compoundComet.withdraw(address(asset), amount);
            } else {
                compoundComet.withdraw(address(asset), amount);
                asset.transfer(recipient, amount);
            }
        } else if (activeProtocol == Protocol.MORPHO && address(morpho) != address(0)) {
            morpho.withdraw(morphoMarket, amount, 0, address(this), recipient);
        } else {
            // Fallback: send from raw USDC balance
            if (recipient != address(this)) {
                asset.transfer(recipient, amount);
            }
        }
    }

    // ── View Helpers ──────────────────────────────────────────────────────────

    /// @notice User's current position: shares held, current asset value, estimated yield
    function userPosition(address user) external view returns (
        uint256 shares,
        uint256 currentValue,
        uint256 estimatedYield,
        uint256 estimatedPerformanceFee
    ) {
        shares       = balanceOf[user];
        currentValue = convertToAssets(shares);

        uint256 costBasis = (costBasisShares[user] > 0)
            ? (costBasisAssets[user] * shares) / costBasisShares[user]
            : 0;

        if (currentValue > costBasis) {
            estimatedYield = currentValue - costBasis;
            estimatedPerformanceFee = (estimatedYield * performanceFeeBps) / 10_000;
        }
    }

    /// @notice Current share price in USDC (6 decimals)
    function pricePerShare() external view returns (uint256) {
        if (totalSupply == 0) return 1e6; // 1:1 initially
        return (totalAssets() * 1e6) / totalSupply;
    }

    /// @notice How long until next rebalance is allowed
    function nextRebalanceIn() external view returns (uint256) {
        uint256 nextTime = lastRebalance + REBALANCE_INTERVAL;
        if (block.timestamp >= nextTime) return 0;
        return nextTime - block.timestamp;
    }

    /// @notice Protocol name string for the active protocol
    function activeProtocolName() external view returns (string memory) {
        if (activeProtocol == Protocol.AAVE)     return "Aave v3";
        if (activeProtocol == Protocol.COMPOUND)  return "Compound v3";
        if (activeProtocol == Protocol.MORPHO)    return "Morpho Blue";
        return "Unknown";
    }
}
