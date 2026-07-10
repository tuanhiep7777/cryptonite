// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title cryptonite (XAE)
 * @notice A teaching token that makes the concepts from the learning notes observable:
 *
 *   - Core ERC-20            (Session 2): transfer / approve / balances / events, via OpenZeppelin.
 *   - Deflationary burn      (Sessions 6-7): a small % of every peer transfer is destroyed,
 *                            so totalSupply shrinks — the same idea as the EIP-1559 base-fee burn.
 *   - Owner mint             (Session 8): the owner can issue new supply — like validator-reward minting.
 *   - Staking rewards        (Session 6): lock tokens to earn a time-based yield ("skin in the game").
 *
 * Everything is intentionally minimal and readable rather than gas-optimal.
 */
contract Cryptonite is ERC20, Ownable {
    // ─────────────────────────────────────────────────────────────────────────
    // Deflationary burn
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Portion of each peer transfer that is burned, in basis points (100 = 1%).
    uint256 public burnRateBps = 100;

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_BURN_RATE_BPS = 1_000; // hard cap: 10%

    event BurnRateUpdated(uint256 oldRateBps, uint256 newRateBps);
    event TransferBurned(address indexed from, uint256 amountBurned);

    // ─────────────────────────────────────────────────────────────────────────
    // Staking
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Annual reward rate for staked tokens, in basis points (1000 = 10% APY).
    uint256 public rewardRateBps = 1_000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    struct StakeInfo {
        uint256 amount; // principal currently staked
        uint256 rewardDebt; // rewards accrued but not yet minted, settled up to `lastUpdated`
        uint256 lastUpdated; // timestamp of the last settlement
    }

    mapping(address => StakeInfo) private _stakes;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 reward);
    event RewardRateUpdated(uint256 oldRateBps, uint256 newRateBps);

    /**
     * @param initialSupply amount (in whole tokens, 18 decimals applied here) minted to the deployer.
     */
    constructor(uint256 initialSupply)
        ERC20("cryptonite", "XAE")
        Ownable(msg.sender)
    {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ERC-20 transfers with a deflationary burn
    //
    // We override the *public* entry points (not _update) so mint, burn, and the
    // internal staking movements below are naturally exempt from the fee.
    // ─────────────────────────────────────────────────────────────────────────

    function transfer(address to, uint256 amount) public override returns (bool) {
        _transferWithBurn(_msgSender(), to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        _spendAllowance(from, _msgSender(), amount);
        _transferWithBurn(from, to, amount);
        return true;
    }

    /// @dev Burns `burnRateBps` of `amount` from `from`, then moves the remainder to `to`.
    function _transferWithBurn(address from, address to, uint256 amount) internal {
        uint256 fee = (amount * burnRateBps) / BPS_DENOMINATOR;
        if (fee > 0) {
            _burn(from, fee);
            emit TransferBurned(from, fee);
        }
        _transfer(from, to, amount - fee);
    }

    function setBurnRateBps(uint256 newRateBps) external onlyOwner {
        require(newRateBps <= MAX_BURN_RATE_BPS, "burn rate too high");
        emit BurnRateUpdated(burnRateBps, newRateBps);
        burnRateBps = newRateBps;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Owner mint (issuance / inflation)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Issue new supply. `amount` is in base units (wei-equivalent, 18 decimals).
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Staking
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Pending, not-yet-minted reward for `user` as of the current block time.
    function pendingReward(address user) public view returns (uint256) {
        StakeInfo storage s = _stakes[user];
        return s.rewardDebt + _accrued(s.amount, s.lastUpdated);
    }

    /// @notice Principal currently staked by `user`.
    function stakedBalanceOf(address user) external view returns (uint256) {
        return _stakes[user].amount;
    }

    /// @dev Linear accrual: amount * rate * elapsed / (10000 * secondsPerYear).
    function _accrued(uint256 amount, uint256 lastUpdated) internal view returns (uint256) {
        if (amount == 0 || lastUpdated == 0) {
            return 0;
        }
        uint256 elapsed = block.timestamp - lastUpdated;
        return (amount * rewardRateBps * elapsed) / (BPS_DENOMINATOR * SECONDS_PER_YEAR);
    }

    /// @dev Fold any newly-accrued reward into rewardDebt and reset the clock.
    function _settle(address user) internal {
        StakeInfo storage s = _stakes[user];
        s.rewardDebt += _accrued(s.amount, s.lastUpdated);
        s.lastUpdated = block.timestamp;
    }

    /// @notice Lock `amount` of your tokens to earn rewards. Fee-exempt (uses internal _transfer).
    function stake(uint256 amount) external {
        require(amount > 0, "amount = 0");
        _settle(_msgSender());
        _transfer(_msgSender(), address(this), amount); // no burn on staking
        _stakes[_msgSender()].amount += amount;
        emit Staked(_msgSender(), amount);
    }

    /// @notice Withdraw `amount` of staked principal. Fee-exempt. Accrued rewards are preserved.
    function unstake(uint256 amount) external {
        StakeInfo storage s = _stakes[_msgSender()];
        require(amount > 0, "amount = 0");
        require(s.amount >= amount, "insufficient stake");
        _settle(_msgSender());
        s.amount -= amount;
        _transfer(address(this), _msgSender(), amount); // return principal, no burn
        emit Unstaked(_msgSender(), amount);
    }

    /// @notice Mint all accrued rewards to yourself (this is where new supply enters).
    function claimReward() external returns (uint256 reward) {
        _settle(_msgSender());
        StakeInfo storage s = _stakes[_msgSender()];
        reward = s.rewardDebt;
        require(reward > 0, "no reward");
        s.rewardDebt = 0;
        _mint(_msgSender(), reward);
        emit RewardClaimed(_msgSender(), reward);
    }

    function setRewardRateBps(uint256 newRateBps) external onlyOwner {
        emit RewardRateUpdated(rewardRateBps, newRateBps);
        rewardRateBps = newRateBps;
    }
}
