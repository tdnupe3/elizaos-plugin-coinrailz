// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ERC8004 Reputation Registry
 * @dev On-chain reputation system for AI agents
 * Clients submit feedback with payment proofs (x402 integration)
 * All reputation data is public goods - anyone can read/aggregate
 */
contract ERC8004ReputationRegistry {
    struct Feedback {
        uint256 agentId; // Agent NFT token ID
        address clientAddress;
        uint8 score; // 0-255
        bytes32 tag1; // Primary skill/task tag
        bytes32 tag2; // Secondary tag
        string fileURI; // IPFS/HTTPS URI to detailed review
        bytes32 fileHash; // Hash of detailed review
        bytes32 paymentProof; // x402 payment transaction hash
        uint256 timestamp;
    }
    
    // All feedback submissions
    Feedback[] public feedbacks;
    
    // Agent ID => feedback indices
    mapping(uint256 => uint256[]) public agentFeedbacks;
    
    // Agent ID => client => authorized
    mapping(uint256 => mapping(address => bool)) public clientAuthorized;
    
    // Events
    event FeedbackAuthorized(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint256 timestamp
    );
    
    event FeedbackSubmitted(
        uint256 indexed feedbackId,
        uint256 indexed agentId,
        address indexed clientAddress,
        uint8 score,
        bytes32 tag1,
        bytes32 tag2,
        string fileURI,
        bytes32 fileHash,
        bytes32 paymentProof,
        uint256 timestamp
    );
    
    event FeedbackRevoked(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint256 timestamp
    );
    
    /**
     * @dev Agent pre-authorizes client to submit feedback
     * Prevents spam and fake reviews
     * @param agentId Agent NFT token ID
     * @param clientAddress Address of client who completed transaction
     */
    function authorizeFeedback(
        uint256 agentId,
        address clientAddress
    ) external {
        require(clientAddress != address(0), "Invalid client");
        
        clientAuthorized[agentId][clientAddress] = true;
        
        emit FeedbackAuthorized(agentId, clientAddress, block.timestamp);
    }
    
    /**
     * @dev Submit feedback for an agent
     * @param agentId Agent NFT token ID
     * @param score Rating (0-255, recommend 0-100 scale)
     * @param tag1 Primary skill/task tag (e.g., keccak256("smart_contract_audit"))
     * @param tag2 Secondary tag (e.g., keccak256("security"))
     * @param fileURI IPFS/HTTPS URI to detailed review
     * @param fileHash Hash of detailed review for verification
     * @param paymentProof Payment transaction hash (x402 or other)
     */
    function submitFeedback(
        uint256 agentId,
        uint8 score,
        bytes32 tag1,
        bytes32 tag2,
        string memory fileURI,
        bytes32 fileHash,
        bytes32 paymentProof
    ) external {
        require(
            clientAuthorized[agentId][msg.sender],
            "Client not authorized by agent"
        );
        require(score <= 100, "Score must be 0-100");
        require(bytes(fileURI).length > 0, "Empty file URI");
        require(paymentProof != bytes32(0), "Payment proof required");
        
        uint256 feedbackId = feedbacks.length;
        
        Feedback memory newFeedback = Feedback({
            agentId: agentId,
            clientAddress: msg.sender,
            score: score,
            tag1: tag1,
            tag2: tag2,
            fileURI: fileURI,
            fileHash: fileHash,
            paymentProof: paymentProof,
            timestamp: block.timestamp
        });
        
        feedbacks.push(newFeedback);
        agentFeedbacks[agentId].push(feedbackId);
        
        // Revoke authorization after use (one-time feedback)
        clientAuthorized[agentId][msg.sender] = false;
        
        emit FeedbackSubmitted(
            feedbackId,
            agentId,
            msg.sender,
            score,
            tag1,
            tag2,
            fileURI,
            fileHash,
            paymentProof,
            block.timestamp
        );
    }
    
    /**
     * @dev Get all feedback for an agent
     * @param agentId Agent NFT token ID
     * @return Array of feedback IDs
     */
    function getAgentFeedbacks(
        uint256 agentId
    ) external view returns (uint256[] memory) {
        return agentFeedbacks[agentId];
    }
    
    /**
     * @dev Get feedback details
     * @param feedbackId Feedback ID
     * @return Feedback struct
     */
    function getFeedback(
        uint256 feedbackId
    ) external view returns (Feedback memory) {
        require(feedbackId < feedbacks.length, "Invalid feedback ID");
        return feedbacks[feedbackId];
    }
    
    /**
     * @dev Calculate average rating for agent
     * @param agentId Agent NFT token ID
     * @return averageScore Average score (0-100 scale)
     * @return feedbackCount Number of feedbacks
     */
    function getAgentReputation(
        uint256 agentId
    ) external view returns (uint256 averageScore, uint256 feedbackCount) {
        uint256[] memory feedbackIds = agentFeedbacks[agentId];
        feedbackCount = feedbackIds.length;
        
        if (feedbackCount == 0) {
            return (0, 0);
        }
        
        uint256 totalScore = 0;
        
        for (uint256 i = 0; i < feedbackCount; i++) {
            totalScore += feedbacks[feedbackIds[i]].score;
        }
        
        averageScore = totalScore / feedbackCount;
        
        return (averageScore, feedbackCount);
    }
    
    /**
     * @dev Get total feedback count
     * @return Total feedbacks in registry
     */
    function totalFeedbacks() external view returns (uint256) {
        return feedbacks.length;
    }
    
    /**
     * @dev Check if client is authorized to submit feedback
     * @param agentId Agent NFT token ID
     * @param clientAddress Client address
     * @return bool Authorization status
     */
    function isClientAuthorized(
        uint256 agentId,
        address clientAddress
    ) external view returns (bool) {
        return clientAuthorized[agentId][clientAddress];
    }
    
    /**
     * @dev Revoke client authorization (in case of dispute)
     * @param agentId Agent NFT token ID
     * @param clientAddress Client to revoke
     */
    function revokeFeedbackAuthorization(
        uint256 agentId,
        address clientAddress
    ) external {
        clientAuthorized[agentId][clientAddress] = false;
        
        emit FeedbackRevoked(agentId, clientAddress, block.timestamp);
    }
}
