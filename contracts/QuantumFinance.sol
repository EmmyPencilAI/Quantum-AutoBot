// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title QuantumFinance
 * @dev Non-custodial auto-trading contract for USDT on BNB Chain.
 */
contract QuantumFinance is Ownable, ReentrancyGuard {
    IERC20 public immutable usdt;
    address public treasury;

    struct UserSession {
        uint256 principal;
        uint256 startTime;
        bool isActive;
    }

    mapping(address => UserSession) public userSessions;

    event Deposited(address indexed user, uint256 amount);
    event Settled(address indexed user, uint256 principal, uint256 profit, uint256 userShare, uint256 treasuryShare);
    event EmergencyWithdrawn(address indexed user, uint256 amount);

    constructor(address _usdt, address _treasury) Ownable(msg.sender) {
        usdt = IERC20(_usdt);
        treasury = _treasury;
    }

    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(!userSessions[msg.sender].isActive, "Session already active");

        usdt.transferFrom(msg.sender, address(this), amount);
        
        userSessions[msg.sender] = UserSession({
            principal: amount,
            startTime: block.timestamp,
            isActive: true
        });

        emit Deposited(msg.sender, amount);
    }

    /**
     * @dev Settles the trading session. 
     * In a real scenario, this would be called by an authorized bot or the user 
     * with a signed message from the trading engine confirming the final balance.
     * For this dApp, we'll assume the trading engine provides the final balance.
     */
    function settle(address user, uint256 finalBalance) external onlyOwner nonReentrant {
        UserSession storage session = userSessions[user];
        require(session.isActive, "No active session");

        uint256 principal = session.principal;
        uint256 profit = 0;
        uint256 userShare = principal;
        uint256 treasuryShare = 0;

        if (finalBalance > principal) {
            profit = finalBalance - principal;
            uint256 halfProfit = profit / 2;
            userShare = principal + halfProfit;
            treasuryShare = halfProfit;
        } else {
            // If loss, user gets what's left
            userShare = finalBalance;
        }

        session.isActive = false;
        session.principal = 0;

        if (userShare > 0) {
            usdt.transfer(user, userShare);
        }
        if (treasuryShare > 0) {
            usdt.transfer(treasury, treasuryShare);
        }

        emit Settled(user, principal, profit, userShare, treasuryShare);
    }

    function emergencyWithdraw() external nonReentrant {
        UserSession storage session = userSessions[msg.sender];
        require(session.isActive, "No active session");
        
        uint256 amount = session.principal;
        session.isActive = false;
        session.principal = 0;

        usdt.transfer(msg.sender, amount);
        emit EmergencyWithdrawn(msg.sender, amount);
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }
}
