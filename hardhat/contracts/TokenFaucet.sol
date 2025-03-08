// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title TokenFaucet
 * @dev A contract that allows users to request tokens for testing purposes.
 * The contract must be funded with tokens by the owner before users can request them.
 */
contract TokenFaucet is Ownable, ReentrancyGuard {
    // Amount of tokens to drip per request (10 tokens with 18 decimals)
    uint256 public dripAmount = 10 * 10**18;
    
    // Cooldown period between requests (in seconds)
    uint256 public cooldownPeriod = 24 hours;
    
    // Mapping to track when a user last requested tokens
    mapping(address => mapping(address => uint256)) public lastRequestTime;
    
    // Event emitted when tokens are dripped
    event TokensDripped(address indexed token, address indexed recipient, uint256 amount);
    
    // Event emitted when drip amount is updated
    event DripAmountUpdated(uint256 newAmount);
    
    // Event emitted when cooldown period is updated
    event CooldownPeriodUpdated(uint256 newPeriod);
    
    /**
     * @dev Request tokens from the faucet
     * @param tokenAddress The address of the token to request
     */
    function requestTokens(address tokenAddress) external nonReentrant {
        require(tokenAddress != address(0), "Invalid token address");
        
        IERC20 token = IERC20(tokenAddress);
        require(token.balanceOf(address(this)) >= dripAmount, "Faucet is empty");
        
        // Check if the user is still in the cooldown period
        require(
            block.timestamp >= lastRequestTime[msg.sender][tokenAddress] + cooldownPeriod,
            "Please wait for the cooldown period to end"
        );
        
        // Update the last request time
        lastRequestTime[msg.sender][tokenAddress] = block.timestamp;
        
        // Transfer tokens to the user
        require(token.transfer(msg.sender, dripAmount), "Token transfer failed");
        
        emit TokensDripped(tokenAddress, msg.sender, dripAmount);
    }
    
    /**
     * @dev Update the drip amount (only owner)
     * @param newDripAmount The new amount of tokens to drip per request
     */
    function setDripAmount(uint256 newDripAmount) external onlyOwner {
        require(newDripAmount > 0, "Drip amount must be greater than 0");
        dripAmount = newDripAmount;
        emit DripAmountUpdated(newDripAmount);
    }
    
    /**
     * @dev Update the cooldown period (only owner)
     * @param newCooldownPeriod The new cooldown period in seconds
     */
    function setCooldownPeriod(uint256 newCooldownPeriod) external onlyOwner {
        cooldownPeriod = newCooldownPeriod;
        emit CooldownPeriodUpdated(newCooldownPeriod);
    }
    
    /**
     * @dev Withdraw tokens from the faucet (only owner)
     * @param tokenAddress The address of the token to withdraw
     * @param amount The amount of tokens to withdraw
     */
    function withdrawTokens(address tokenAddress, uint256 amount) external onlyOwner {
        require(tokenAddress != address(0), "Invalid token address");
        require(amount > 0, "Amount must be greater than 0");
        
        IERC20 token = IERC20(tokenAddress);
        require(token.balanceOf(address(this)) >= amount, "Insufficient balance");
        
        require(token.transfer(owner(), amount), "Token transfer failed");
    }
} 