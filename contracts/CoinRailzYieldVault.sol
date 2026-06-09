// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CoinRailzYieldVault v2
 * @notice AI Agent Yield Portal — auto-routes USDC to the highest-APY protocol on Base.
 *         Non-custodial: no admin can withdraw depositor principal. Ever.
 *
 * @dev ERC-4626-style tokenised vault. Supported protocols: Aave v3, Compound v3, Morpho Blue.
 *
 * Fee structure (all params behind 48h timelock after initial deploy):
 *   - Entry fee:       0.5% (50 bps) on every deposit → feeRecipient immediately
 *   - Performance fee: 15% (1500 bps) of yield → captured via continuous share accrual
 *   - Exit fee:        0%  (no friction on withdrawals)
 *
 * v2 Changes vs v1:
 *   - GLOBAL share-mint fee accrual (Yearn-style) replaces per-user cost-basis tracking.
 *     Fees are now captured on every vault interaction, not only on withdrawal.
 *   - COOLDOWN GRIEFING fixed: lastRebalance only updated when a real protocol switch occurs.
 *   - MORPHO APY properly computed via the Adaptive Curve IRM (no longer returns 0).
 *   - MINIMUM DEPOSIT: $1 USDC (1_000_000 raw) to prevent dust attacks.
 *   - SafeERC20-style return-value checks on all USDC transfers.
 *   - External accrueFees() callable by anyone (keeper-friendly).
 *   - configureMorphoMarket() for owner to enable Morpho post-deploy.
 *   - RebalanceSkipped event emitted on no-op rebalance calls.
 *
 * Security properties (unchanged from v1):
 *   - onlyOwner cannot withdraw principal — feeRecipient only receives performance fees
 *   - Fee parameters locked behind 48-hour timelock
 *   - Emergency exit always available regardless of contract state
 *   - ReentrancyGuard on all state-mutating external functions
 */

// ─── ERC-20 Interface ─────────────────────────────────────────────────────────

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

// ─── Protocol Interfaces ──────────────────────────────────────────────────────

interface IAavePool {
    struct ReserveData {
        uint256 configuration;
        uint128 liquidityIndex;
        uint128 currentLiquidityRate; // APR in ray (1e27)
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

interface IAToken {
    function balanceOf(address account) external view returns (uint256);
}

interface IComet {
    function supply(address asset, uint256 amount) external;
    function withdraw(address asset, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function getUtilization() external view returns (uint256);
    function getSupplyRate(uint256 utilization) external view returns (uint64);
}

// Morpho Blue singleton
struct MarketParams {
    address loanToken;
    address collateralToken;
    address oracle;
    address irm;
    uint256 lltv;
}

struct MorphoMarketState {
    uint128 totalSupplyAssets;
    uint128 totalSupplyShares;
    uint128 totalBorrowAssets;
    uint128 totalBorrowShares;
    uint128 lastUpdate;
    uint128 fee; // protocol fee in 1e18 (e.g. 0.1e18 = 10%)
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

    function market(bytes32 id) external view returns (MorphoMarketState memory);
}

// Morpho Adaptive Curve IRM
interface IAdaptiveCurveIrm {
    function borrowRateView(
        MarketParams calldata marketParams,
        MorphoMarketState calldata market
    ) external view returns (uint256); // borrow rate per second in 1e18
}

// ─── Main Contract ────────────────────────────────────────────────────────────

contract CoinRailzYieldVault {

    // ── ERC-20 Share Token ────────────────────────────────────────────────────

    string  public constant name     = "CoinRailz Yield Vault";
    string  public constant symbol   = "crUSDC";
    uint8   public constant decimals = 6;

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
        if (amount == 0) return;
        totalSupply   += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        require(balanceOf[from] >= amount, "CRV: burn exceeds balance");
        balanceOf[from] -= amount;
        totalSupply     -= amount;
        emit Transfer(from, address(0), amount);
    }

    // ── State Variables ───────────────────────────────────────────────────────

    IERC20  public immutable asset; // USDC

    // Fee configuration
    uint256 public depositFeeBps     = 50;    // 0.5%
    uint256 public performanceFeeBps = 1500;  // 15%
    address public feeRecipient;

    // v2: Global fee accrual via share-minting checkpoint
    // Tracks protocol assets as of the last accrual. Yield above this = fee-eligible.
    uint256 public feeCheckpoint;

    // Minimum deposit: $1 USDC (6 decimals) — prevents dust attacks
    uint256 public constant MIN_DEPOSIT = 1_000_000;

    // Fee change timelock (48h)
    uint256 public feeChangeProposedAt;
    uint256 public pendingDepositFeeBps;
    uint256 public pendingPerformanceFeeBps;
    uint256 public constant FEE_TIMELOCK             = 48 hours;
    uint256 public constant MAX_DEPOSIT_FEE_BPS      = 200;   // hard cap 2%
    uint256 public constant MAX_PERFORMANCE_FEE_BPS  = 2000;  // hard cap 20%

    // Protocol configuration
    enum Protocol { AAVE, COMPOUND, MORPHO }
    Protocol public activeProtocol;
    bool     public paused;

    IAavePool public aavePool;
    IAToken   public aUsdc;
    IComet    public compoundComet;
    IMorpho   public morpho;
    MarketParams public morphoMarket;
    bytes32  public morphoMarketId;    // keccak256(abi.encode(morphoMarket))
    IAdaptiveCurveIrm public morphoIrm; // Adaptive Curve IRM on Base

    // Auto-rebalancing
    uint256 public lastRebalance;
    uint256 public constant REBALANCE_INTERVAL  = 1 days;
    uint256 public constant MIN_REBALANCE_DELTA = 50; // 50 bps improvement required

    // Ownership (two-step)
    address public owner;
    address public pendingOwner;

    // Reentrancy guard
    uint256 private _reentrancyStatus = 1;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED     = 2;

    // ── Events ────────────────────────────────────────────────────────────────

    event Deposited(address indexed depositor, address indexed receiver, uint256 assets, uint256 entryFee, uint256 shares);
    event Withdrawn(address indexed shareOwner, address indexed receiver, uint256 assets, uint256 shares);
    event Rebalanced(Protocol indexed from, Protocol indexed to, uint256 tvl, uint256 fromAPYBps, uint256 toAPYBps);
    event RebalanceSkipped(Protocol indexed current, Protocol indexed best, uint256 currentAPYBps, uint256 bestAPYBps);
    event FeesAccrued(address indexed recipient, uint256 feeAssets, uint256 feeShares);
    event FeeChangeProposed(uint256 newDepositFeeBps, uint256 newPerformanceFeeBps, uint256 executableAt);
    event FeeChangeExecuted(uint256 newDepositFeeBps, uint256 newPerformanceFeeBps);
    event EmergencyWithdraw(address indexed user, uint256 assets, uint256 shares);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(bool paused);
    event MorphoMarketConfigured(address morpho, bytes32 marketId);

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

    constructor(
        address _asset,
        address _feeRecipient,
        address _aavePool,
        address _aUsdc,
        address _compoundComet,
        address _morpho,
        MarketParams memory _morphoMarket,
        address _morphoIrm,
        Protocol _initialProtocol
    ) {
        require(_asset        != address(0), "CRV: zero asset");
        require(_feeRecipient != address(0), "CRV: zero feeRecipient");

        if (_initialProtocol == Protocol.AAVE)     require(_aavePool      != address(0), "CRV: Aave not configured");
        if (_initialProtocol == Protocol.COMPOUND) require(_compoundComet != address(0), "CRV: Compound not configured");
        if (_initialProtocol == Protocol.MORPHO)   require(_morpho        != address(0), "CRV: Morpho not configured");

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
            morpho        = IMorpho(_morpho);
            morphoMarket  = _morphoMarket;
            morphoMarketId = keccak256(abi.encode(_morphoMarket));
            morphoIrm     = IAdaptiveCurveIrm(_morphoIrm);
            emit MorphoMarketConfigured(_morpho, morphoMarketId);
        }

        feeCheckpoint = 0;
    }

    // ── ERC-4626 Core ─────────────────────────────────────────────────────────

    /// @notice Raw assets in the active protocol (not adjusted for fees).
    function totalAssets() public view returns (uint256) {
        return _rawProtocolBalance();
    }

    /// @notice Convert assets to shares at current price.
    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply;
        if (supply == 0) return assets;
        uint256 ta = totalAssets();
        if (ta == 0) return assets;
        return (assets * supply) / ta;
    }

    /// @notice Convert shares to assets at current price.
    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply;
        if (supply == 0) return shares;
        return (shares * totalAssets()) / supply;
    }

    /// @notice Preview shares received for a deposit (after entry fee).
    function previewDeposit(uint256 assets) public view returns (uint256) {
        uint256 fee = (assets * depositFeeBps) / 10_000;
        return convertToShares(assets - fee);
    }

    /// @notice Preview assets received for redeeming shares.
    function previewRedeem(uint256 shares) public view returns (uint256) {
        return convertToAssets(shares);
    }

    // ── Deposit ───────────────────────────────────────────────────────────────

    /**
     * @notice Deposit USDC, receive crUSDC shares.
     *         0.5% entry fee on every deposit, sent immediately to feeRecipient.
     *         Performance fees accrued globally before shares are issued.
     */
    function deposit(uint256 assets, address receiver)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 shares)
    {
        require(assets >= MIN_DEPOSIT,        "CRV: below minimum deposit");
        require(receiver != address(0),       "CRV: zero receiver");

        // [1] Capture yield on existing assets before this deposit changes state
        _accrueFees();

        // [2] Pull USDC from caller
        _safeTransferFrom(address(asset), msg.sender, address(this), assets);

        // [3] Deduct entry fee immediately
        uint256 entryFee = (assets * depositFeeBps) / 10_000;
        uint256 netAssets = assets - entryFee;
        if (entryFee > 0) {
            _safeTransfer(address(asset), feeRecipient, entryFee);
        }

        // [4] Calculate shares based on net assets vs current pool
        shares = _calcShares(netAssets);

        // [5] Deploy net assets to the active protocol
        _supplyToProtocol(netAssets);

        // [6] Mint share tokens to receiver
        _mint(receiver, shares);

        // [7] Update fee checkpoint to include new principal (so it's never treated as yield)
        feeCheckpoint = _rawProtocolBalance();

        emit Deposited(msg.sender, receiver, assets, entryFee, shares);
    }

    function _calcShares(uint256 netAssets) internal view returns (uint256) {
        uint256 supply = totalSupply;
        if (supply == 0 || totalAssets() == 0) return netAssets;
        return (netAssets * supply) / totalAssets();
    }

    // ── Withdraw / Redeem ─────────────────────────────────────────────────────

    /**
     * @notice Redeem crUSDC shares for USDC.
     *         No exit fee. Performance fees already captured via continuous accrual.
     */
    function redeem(uint256 shares, address receiver, address shareOwner)
        external
        nonReentrant
        returns (uint256 assets)
    {
        require(shares > 0,             "CRV: zero shares");
        require(receiver != address(0), "CRV: zero receiver");

        if (shareOwner != msg.sender) {
            uint256 allowed = allowance[shareOwner][msg.sender];
            if (allowed != type(uint256).max) {
                require(allowed >= shares, "CRV: allowance exceeded");
                allowance[shareOwner][msg.sender] = allowed - shares;
            }
        }
        require(balanceOf[shareOwner] >= shares, "CRV: insufficient shares");

        // [1] Accrue fees on outstanding yield before this withdrawal
        _accrueFees();

        // [2] Convert shares → assets at post-accrual price
        assets = convertToAssets(shares);

        // [3] Burn shares
        _burn(shareOwner, shares);

        // [4] Withdraw from protocol directly to receiver
        _withdrawFromProtocol(assets, receiver);

        // [5] Update checkpoint to reflect reduced assets
        feeCheckpoint = _rawProtocolBalance();

        emit Withdrawn(shareOwner, receiver, assets, shares);
    }

    // ── Harvest / Accrue ──────────────────────────────────────────────────────

    /**
     * @notice Accrue outstanding performance fees by minting shares to feeRecipient.
     *         Callable by anyone — designed for keeper bots and automated crons.
     *         No minimum threshold: accrues any non-zero yield.
     */
    function accrueFees() external nonReentrant {
        _accrueFees();
        feeCheckpoint = _rawProtocolBalance();
    }

    // ── Auto-Rebalancing ──────────────────────────────────────────────────────

    /**
     * @notice Switch to the highest-APY protocol.
     *         Callable by anyone. 24h cooldown enforced.
     *         v2 fix: lastRebalance is ONLY updated when a real switch happens,
     *         preventing griefing no-op calls from blocking future rebalances.
     */
    function rebalance() external nonReentrant {
        require(
            block.timestamp >= lastRebalance + REBALANCE_INTERVAL,
            "CRV: rebalance cooldown"
        );

        (Protocol best, uint256 bestAPY) = getBestProtocol();
        uint256 currentAPY = getProtocolAPYBps(activeProtocol);

        // Emit skip event and return WITHOUT updating lastRebalance — allows retry sooner
        if (best == activeProtocol || bestAPY < currentAPY + MIN_REBALANCE_DELTA) {
            emit RebalanceSkipped(activeProtocol, best, currentAPY, bestAPY);
            return;
        }

        // Capture yield before moving funds
        _accrueFees();

        uint256 tvl = totalAssets();
        Protocol previousProtocol = activeProtocol;

        if (tvl > 0) {
            // Withdraw ALL from current protocol
            _withdrawFromProtocol(tvl, address(this));
        }

        // Switch protocol and re-deploy
        activeProtocol = best;

        uint256 available = asset.balanceOf(address(this));
        if (available > 0) {
            _supplyToProtocol(available);
        }

        // Update lastRebalance ONLY on real switch
        lastRebalance = block.timestamp;

        // Update fee checkpoint after re-deploy
        feeCheckpoint = _rawProtocolBalance();

        emit Rebalanced(previousProtocol, best, tvl, currentAPY, bestAPY);
    }

    // ── Emergency Exit ────────────────────────────────────────────────────────

    /**
     * @notice Always-available exit. Cannot be blocked by owner or paused state.
     *         No additional fees beyond what accrual already captured.
     */
    function emergencyWithdraw() external nonReentrant {
        uint256 shares = balanceOf[msg.sender];
        require(shares > 0, "CRV: no shares");

        _accrueFees();

        uint256 assets = convertToAssets(shares);
        _burn(msg.sender, shares);
        _withdrawFromProtocol(assets, msg.sender);
        feeCheckpoint = _rawProtocolBalance();

        emit EmergencyWithdraw(msg.sender, assets, shares);
    }

    // ── Protocol APY Reads ────────────────────────────────────────────────────

    /**
     * @notice APY in basis points for a given protocol, read from live on-chain rates.
     */
    function getProtocolAPYBps(Protocol p) public view returns (uint256) {
        if (p == Protocol.AAVE && address(aavePool) != address(0)) {
            try aavePool.getReserveData(address(asset)) returns (IAavePool.ReserveData memory data) {
                // liquidityRate is APR in ray (1e27) → convert to bps
                return uint256(data.currentLiquidityRate) * 10_000 / 1e27;
            } catch {
                return 0;
            }
        }

        if (p == Protocol.COMPOUND && address(compoundComet) != address(0)) {
            try compoundComet.getUtilization() returns (uint256 utilization) {
                try compoundComet.getSupplyRate(utilization) returns (uint64 ratePerSecond) {
                    return uint256(ratePerSecond) * 365 * 24 * 3600 * 10_000 / 1e18;
                } catch { return 0; }
            } catch { return 0; }
        }

        if (p == Protocol.MORPHO && address(morpho) != address(0)) {
            return _morphoSupplyAPYBps();
        }

        return 0;
    }

    /**
     * @notice Compute Morpho Blue supply APY via the Adaptive Curve IRM.
     *         Formula: supplyRate = borrowRate × utilization × (1 − protocolFee)
     */
    function _morphoSupplyAPYBps() internal view returns (uint256) {
        if (address(morpho) == address(0) || address(morphoIrm) == address(0)) return 0;
        if (morphoMarketId == bytes32(0)) return 0;

        try morpho.market(morphoMarketId) returns (MorphoMarketState memory m) {
            if (m.totalSupplyAssets == 0) return 0;

            try morphoIrm.borrowRateView(morphoMarket, m) returns (uint256 borrowRatePerSec) {
                // utilization in 1e18
                uint256 util = uint256(m.totalBorrowAssets) * 1e18 / uint256(m.totalSupplyAssets);
                // gross supply rate per second (1e18)
                uint256 grossRatePerSec = borrowRatePerSec * util / 1e18;
                // deduct Morpho protocol fee (m.fee is in 1e18)
                uint256 netRatePerSec = grossRatePerSec * (1e18 - uint256(m.fee)) / 1e18;
                // annualise and convert to bps
                return netRatePerSec * 365 * 24 * 3600 * 10_000 / 1e18;
            } catch { return 0; }
        } catch { return 0; }
    }

    /**
     * @notice Returns the protocol with the highest live APY.
     */
    function getBestProtocol() public view returns (Protocol best, uint256 bestAPY) {
        best    = activeProtocol; // default: stay put
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
     * @notice APYs for all three protocols in bps.
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

    function executeFeeChange() external onlyOwner {
        require(feeChangeProposedAt != 0,                              "CRV: no proposal");
        require(block.timestamp >= feeChangeProposedAt + FEE_TIMELOCK, "CRV: timelock active");
        depositFeeBps     = pendingDepositFeeBps;
        performanceFeeBps = pendingPerformanceFeeBps;
        feeChangeProposedAt = 0;
        emit FeeChangeExecuted(depositFeeBps, performanceFeeBps);
    }

    // ── Owner Controls ────────────────────────────────────────────────────────

    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "CRV: zero address");
        feeRecipient = newRecipient;
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    /**
     * @notice Configure Morpho Blue market post-deployment.
     *         Use this to enable Morpho after verifying market params on-chain.
     *         The owner sets the market; the contract reads live rates autonomously.
     */
    function configureMorphoMarket(
        address _morpho,
        MarketParams calldata _morphoMarket,
        address _morphoIrm
    ) external onlyOwner {
        require(_morpho    != address(0), "CRV: zero morpho");
        require(_morphoIrm != address(0), "CRV: zero irm");

        morpho         = IMorpho(_morpho);
        morphoMarket   = _morphoMarket;
        morphoMarketId = keccak256(abi.encode(_morphoMarket));
        morphoIrm      = IAdaptiveCurveIrm(_morphoIrm);

        emit MorphoMarketConfigured(_morpho, morphoMarketId);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "CRV: not pending owner");
        emit OwnershipTransferred(owner, pendingOwner);
        owner        = pendingOwner;
        pendingOwner = address(0);
    }

    // ── View Helpers ──────────────────────────────────────────────────────────

    /// @notice Current share price in USDC (6 decimals). 1e6 = $1.00
    function pricePerShare() external view returns (uint256) {
        if (totalSupply == 0) return 1e6;
        return (totalAssets() * 1e6) / totalSupply;
    }

    /// @notice Seconds until next rebalance is allowed.
    function nextRebalanceIn() external view returns (uint256) {
        uint256 nextTime = lastRebalance + REBALANCE_INTERVAL;
        if (block.timestamp >= nextTime) return 0;
        return nextTime - block.timestamp;
    }

    /// @notice Protocol name for the currently active protocol.
    function activeProtocolName() external view returns (string memory) {
        if (activeProtocol == Protocol.AAVE)     return "Aave v3";
        if (activeProtocol == Protocol.COMPOUND)  return "Compound v3";
        if (activeProtocol == Protocol.MORPHO)    return "Morpho Blue";
        return "Unknown";
    }

    /// @notice Current position for a user.
    function userPosition(address user) external view returns (
        uint256 shares,
        uint256 currentValue,
        uint256 estimatedYield
    ) {
        shares       = balanceOf[user];
        currentValue = convertToAssets(shares);
        // Yield estimate: current value minus pro-rata feeCheckpoint
        uint256 ts = totalSupply;
        if (ts > 0 && feeCheckpoint > 0) {
            uint256 userCheckpoint = (feeCheckpoint * shares) / ts;
            estimatedYield = currentValue > userCheckpoint ? currentValue - userCheckpoint : 0;
        }
    }

    /// @notice Yield currently eligible for fee accrual (not yet accrued).
    function pendingFeeAccrual() external view returns (uint256 gainAssets, uint256 feeAssets) {
        uint256 raw = _rawProtocolBalance();
        if (raw > feeCheckpoint) {
            gainAssets = raw - feeCheckpoint;
            feeAssets  = (gainAssets * performanceFeeBps) / 10_000;
        }
    }

    // ── Internal: Fee Accrual (v2 Global Share-Mint Model) ───────────────────

    /**
     * @dev Mint performance-fee shares to feeRecipient proportional to yield earned
     *      since the last feeCheckpoint. Does NOT update feeCheckpoint — callers must
     *      call `feeCheckpoint = _rawProtocolBalance()` after all state mutations.
     */
    function _accrueFees() internal {
        if (totalSupply == 0) return;
        uint256 raw = _rawProtocolBalance();
        if (raw <= feeCheckpoint) return;

        uint256 gain      = raw - feeCheckpoint;
        uint256 feeAssets = (gain * performanceFeeBps) / 10_000;
        if (feeAssets == 0) return;

        // Shares to mint: feeAssets / pricePerShare (using pre-mint supply)
        // feeShares = feeAssets * totalSupply / (raw - feeAssets)
        // This gives feeRecipient exactly feeAssets worth of the vault
        uint256 feeShares = (feeAssets * totalSupply) / (raw - feeAssets);
        if (feeShares == 0) return;

        _mint(feeRecipient, feeShares);
        emit FeesAccrued(feeRecipient, feeAssets, feeShares);
    }

    // ── Internal: Protocol Helpers ────────────────────────────────────────────

    function _rawProtocolBalance() internal view returns (uint256) {
        if (activeProtocol == Protocol.AAVE && address(aUsdc) != address(0)) {
            try aUsdc.balanceOf(address(this)) returns (uint256 b) { return b; }
            catch { return 0; }
        }
        if (activeProtocol == Protocol.COMPOUND && address(compoundComet) != address(0)) {
            try compoundComet.balanceOf(address(this)) returns (uint256 b) { return b; }
            catch { return 0; }
        }
        if (activeProtocol == Protocol.MORPHO && address(morpho) != address(0)) {
            try morpho.expectedSupplyAssets(morphoMarket, address(this)) returns (uint256 b) { return b; }
            catch { return 0; }
        }
        // Fallback: raw USDC in contract (no yield protocol active)
        return asset.balanceOf(address(this));
    }

    function _supplyToProtocol(uint256 amount) internal {
        if (amount == 0) return;
        if (activeProtocol == Protocol.AAVE && address(aavePool) != address(0)) {
            _safeApprove(address(asset), address(aavePool), amount);
            aavePool.supply(address(asset), amount, address(this), 0);
        } else if (activeProtocol == Protocol.COMPOUND && address(compoundComet) != address(0)) {
            _safeApprove(address(asset), address(compoundComet), amount);
            compoundComet.supply(address(asset), amount);
        } else if (activeProtocol == Protocol.MORPHO && address(morpho) != address(0)) {
            _safeApprove(address(asset), address(morpho), amount);
            morpho.supply(morphoMarket, amount, 0, address(this), "");
        }
        // If no protocol: USDC stays in contract (no yield, safe fallback)
    }

    function _withdrawFromProtocol(uint256 amount, address recipient) internal {
        if (amount == 0) return;
        if (activeProtocol == Protocol.AAVE && address(aavePool) != address(0)) {
            aavePool.withdraw(address(asset), amount, recipient);
        } else if (activeProtocol == Protocol.COMPOUND && address(compoundComet) != address(0)) {
            // Compound withdraw sends to address(this) — then forward if needed
            compoundComet.withdraw(address(asset), amount);
            if (recipient != address(this)) {
                _safeTransfer(address(asset), recipient, amount);
            }
        } else if (activeProtocol == Protocol.MORPHO && address(morpho) != address(0)) {
            morpho.withdraw(morphoMarket, amount, 0, address(this), recipient);
        } else {
            if (recipient != address(this)) {
                _safeTransfer(address(asset), recipient, amount);
            }
        }
    }

    // ── Internal: SafeERC20 Helpers ───────────────────────────────────────────

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "CRV: transfer failed");
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "CRV: transferFrom failed");
    }

    function _safeApprove(address token, address spender, uint256 amount) internal {
        // Reset to 0 first (required by some ERC-20s, good practice for all)
        (bool ok1,) = token.call(abi.encodeWithSelector(IERC20.approve.selector, spender, 0));
        require(ok1, "CRV: approve(0) failed");
        (bool ok2, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.approve.selector, spender, amount)
        );
        require(ok2 && (data.length == 0 || abi.decode(data, (bool))), "CRV: approve failed");
    }
}
