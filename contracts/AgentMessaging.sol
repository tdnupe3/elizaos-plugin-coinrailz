// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title AgentMessaging
 * @dev Simple on-chain messaging contract for AI agent outreach
 * Messages are permanently stored on-chain and visible on Basescan
 */
contract AgentMessaging {
    struct Message {
        address sender;
        address recipient;
        string content;
        uint256 timestamp;
    }

    // Store all messages
    Message[] public messages;
    
    // Map recipient address to their message indices
    mapping(address => uint256[]) public recipientMessages;
    
    // Map sender address to their message indices
    mapping(address => uint256[]) public senderMessages;

    // Events for easy indexing
    event MessageSent(
        uint256 indexed messageId,
        address indexed sender,
        address indexed recipient,
        string content,
        uint256 timestamp
    );

    /**
     * @dev Send a message to a recipient
     * @param recipient Address of the message recipient
     * @param content Message content
     */
    function sendMessage(address recipient, string calldata content) external returns (uint256) {
        require(recipient != address(0), "Invalid recipient");
        require(bytes(content).length > 0, "Empty message");
        require(bytes(content).length <= 1000, "Message too long");

        uint256 messageId = messages.length;
        
        Message memory newMessage = Message({
            sender: msg.sender,
            recipient: recipient,
            content: content,
            timestamp: block.timestamp
        });

        messages.push(newMessage);
        recipientMessages[recipient].push(messageId);
        senderMessages[msg.sender].push(messageId);

        emit MessageSent(messageId, msg.sender, recipient, content, block.timestamp);

        return messageId;
    }

    /**
     * @dev Get total number of messages
     */
    function getMessageCount() external view returns (uint256) {
        return messages.length;
    }

    /**
     * @dev Get messages sent to a specific recipient
     */
    function getRecipientMessages(address recipient) external view returns (uint256[] memory) {
        return recipientMessages[recipient];
    }

    /**
     * @dev Get messages sent by a specific sender
     */
    function getSenderMessages(address sender) external view returns (uint256[] memory) {
        return senderMessages[sender];
    }

    /**
     * @dev Get message details by ID
     */
    function getMessage(uint256 messageId) external view returns (
        address sender,
        address recipient,
        string memory content,
        uint256 timestamp
    ) {
        require(messageId < messages.length, "Invalid message ID");
        Message memory message = messages[messageId];
        return (message.sender, message.recipient, message.content, message.timestamp);
    }
}
