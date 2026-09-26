// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PackChainAnchor
/// @notice Public anchor for the PackAI permissioned traceability ledger (PackChain).
///         The off-chain ledger periodically commits (block index, block hash, Merkle root)
///         here so that anyone can verify, without trusting the platform operator, that a
///         packaging batch record existed unaltered at a given time.
contract PackChainAnchor {
    struct Anchor {
        bytes32 blockHash;
        bytes32 merkleRoot;
        uint64 timestamp;
        address operator;
    }

    address public owner;
    mapping(address => bool) public operators;
    mapping(uint64 => Anchor) public anchors;          // PackChain block index => anchor
    mapping(bytes32 => bytes32) public batchSpecHash;  // keccak(batchId) => SHA-256 of packaging spec
    uint64 public anchorCount;
    uint64 public latestIndex;

    event Anchored(uint64 indexed blockIndex, bytes32 blockHash, bytes32 merkleRoot, address indexed operator);
    event BatchRegistered(bytes32 indexed batchKey, bytes32 specHash, address indexed operator);
    event OperatorUpdated(address indexed operator, bool enabled);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "PackChain: not owner");
        _;
    }

    modifier onlyOperator() {
        require(operators[msg.sender], "PackChain: not operator");
        _;
    }

    constructor() {
        owner = msg.sender;
        operators[msg.sender] = true;
        emit OperatorUpdated(msg.sender, true);
    }

    function setOperator(address operator, bool enabled) external onlyOwner {
        operators[operator] = enabled;
        emit OperatorUpdated(operator, enabled);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "PackChain: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Commit a PackChain block. Anchors are immutable once written.
    function anchor(uint64 blockIndex, bytes32 blockHash, bytes32 merkleRoot) external onlyOperator {
        require(blockHash != bytes32(0), "PackChain: empty hash");
        require(anchors[blockIndex].timestamp == 0, "PackChain: already anchored");
        anchors[blockIndex] = Anchor(blockHash, merkleRoot, uint64(block.timestamp), msg.sender);
        anchorCount += 1;
        if (blockIndex > latestIndex) latestIndex = blockIndex;
        emit Anchored(blockIndex, blockHash, merkleRoot, msg.sender);
    }

    /// @notice Register the hash of a batch's packaging specification (write-once).
    function registerBatch(string calldata batchId, bytes32 specHash) external onlyOperator {
        bytes32 key = keccak256(bytes(batchId));
        require(batchSpecHash[key] == bytes32(0), "PackChain: batch exists");
        batchSpecHash[key] = specHash;
        emit BatchRegistered(key, specHash, msg.sender);
    }

    function verifyBlock(uint64 blockIndex, bytes32 blockHash) external view returns (bool) {
        return anchors[blockIndex].blockHash == blockHash && blockHash != bytes32(0);
    }

    function verifyBatch(string calldata batchId, bytes32 specHash) external view returns (bool) {
        return batchSpecHash[keccak256(bytes(batchId))] == specHash && specHash != bytes32(0);
    }
}
