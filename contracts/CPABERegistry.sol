// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract RegistrationLog {
    event UserRegistered(address indexed user, string message);

    function registerUser() public {
        emit UserRegistered(msg.sender, "User registered successfully");
    }
}

