// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../src/AuditChain.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeployAuditChain {
    Vm constant vm = Vm(address(bytes20(uint160(uint256(keccak256("hevm cheat code"))))));

    function run() external returns (AuditChain auditChain) {
        vm.startBroadcast();
        auditChain = new AuditChain();
        vm.stopBroadcast();
    }
}
