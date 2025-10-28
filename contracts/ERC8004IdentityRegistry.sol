// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ERC8004 Identity Registry
 * @dev ERC-8004 compliant AI Agent Identity Registry
 * Each agent receives an ERC-721 NFT as portable on-chain identity
 * NFT resolves to Agent Card JSON (A2A protocol compliant)
 */
contract ERC8004IdentityRegistry is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    
    // Map agent EVM address to token ID
    mapping(address => uint256) public agentToTokenId;
    
    // Map token ID to agent EVM address
    mapping(uint256 => address) public tokenIdToAgent;
    
    // Agent registration status
    mapping(address => bool) public isRegistered;
    
    // Events
    event AgentRegistered(
        uint256 indexed tokenId,
        address indexed agentAddress,
        string agentCardURI,
        uint256 timestamp
    );
    
    event AgentCardUpdated(
        uint256 indexed tokenId,
        address indexed agentAddress,
        string newAgentCardURI,
        uint256 timestamp
    );
    
    event AgentTransferred(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        uint256 timestamp
    );
    
    constructor() ERC721("AI Agent Identity", "AGENT") Ownable(msg.sender) {
        _nextTokenId = 1; // Start from token ID 1
    }
    
    /**
     * @dev Register a new AI agent and mint identity NFT
     * @param agentAddress EVM address of the agent
     * @param agentCardURI URI pointing to Agent Card JSON (IPFS/HTTPS)
     * @return tokenId The minted token ID
     */
    function registerAgent(
        address agentAddress,
        string memory agentCardURI
    ) external returns (uint256) {
        require(agentAddress != address(0), "Invalid agent address");
        require(!isRegistered[agentAddress], "Agent already registered");
        require(bytes(agentCardURI).length > 0, "Empty agent card URI");
        
        uint256 tokenId = _nextTokenId++;
        
        // Mint NFT to agent address
        _safeMint(agentAddress, tokenId);
        _setTokenURI(tokenId, agentCardURI);
        
        // Update mappings
        agentToTokenId[agentAddress] = tokenId;
        tokenIdToAgent[tokenId] = agentAddress;
        isRegistered[agentAddress] = true;
        
        emit AgentRegistered(tokenId, agentAddress, agentCardURI, block.timestamp);
        
        return tokenId;
    }
    
    /**
     * @dev Update agent card URI (agent metadata)
     * @param tokenId Token ID of the agent
     * @param newAgentCardURI New URI for agent card
     */
    function updateAgentCard(
        uint256 tokenId,
        string memory newAgentCardURI
    ) external {
        require(_ownerOf(tokenId) == msg.sender, "Not agent owner");
        require(bytes(newAgentCardURI).length > 0, "Empty URI");
        
        _setTokenURI(tokenId, newAgentCardURI);
        
        emit AgentCardUpdated(
            tokenId,
            tokenIdToAgent[tokenId],
            newAgentCardURI,
            block.timestamp
        );
    }
    
    /**
     * @dev Get agent token ID by address
     * @param agentAddress Agent EVM address
     * @return tokenId The agent's token ID (0 if not registered)
     */
    function getAgentTokenId(address agentAddress) external view returns (uint256) {
        return agentToTokenId[agentAddress];
    }
    
    /**
     * @dev Get agent address by token ID
     * @param tokenId Token ID
     * @return agentAddress The agent's EVM address
     */
    function getAgentAddress(uint256 tokenId) external view returns (address) {
        return tokenIdToAgent[tokenId];
    }
    
    /**
     * @dev Get agent card URI
     * @param tokenId Token ID
     * @return Agent card URI
     */
    function getAgentCard(uint256 tokenId) external view returns (string memory) {
        return tokenURI(tokenId);
    }
    
    /**
     * @dev Check if agent is registered
     * @param agentAddress Agent EVM address
     * @return bool Registration status
     */
    function isAgentRegistered(address agentAddress) external view returns (bool) {
        return isRegistered[agentAddress];
    }
    
    /**
     * @dev Get total registered agents
     * @return Total number of agents
     */
    function totalAgents() external view returns (uint256) {
        return _nextTokenId - 1;
    }
    
    /**
     * @dev Override transfer to emit custom event
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        address previousOwner = super._update(to, tokenId, auth);
        
        if (from != address(0) && to != address(0) && from != to) {
            // Update agent address mapping
            tokenIdToAgent[tokenId] = to;
            
            // Clear old mapping
            delete agentToTokenId[from];
            agentToTokenId[to] = tokenId;
            
            emit AgentTransferred(tokenId, from, to, block.timestamp);
        }
        
        return previousOwner;
    }
}
