/**
 * Read messages from AgentMessaging smart contract
 */

import { createPublicClient, http, formatUnits } from 'viem';
import { base } from 'viem/chains';
import contractConfig from '../messaging-contract-config.json' assert { type: 'json' };

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org')
});

async function readMessages() {
  console.log('📖 Reading messages from AgentMessaging contract...');
  console.log(`Contract: ${contractConfig.address}\n`);

  try {
    // Get message count
    const messageCount = await publicClient.readContract({
      address: contractConfig.address as `0x${string}`,
      abi: contractConfig.abi,
      functionName: 'getMessageCount'
    }) as bigint;

    console.log(`Total messages: ${messageCount}\n`);

    if (messageCount === 0n) {
      console.log('No messages found in contract.');
      return;
    }

    // Read all messages
    for (let i = 0n; i < messageCount; i++) {
      const message = await publicClient.readContract({
        address: contractConfig.address as `0x${string}`,
        abi: contractConfig.abi,
        functionName: 'getMessage',
        args: [i]
      }) as [string, string, string, bigint];

      const [sender, recipient, content, timestamp] = message;
      const date = new Date(Number(timestamp) * 1000);

      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Message #${i}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`From: ${sender}`);
      console.log(`To: ${recipient}`);
      console.log(`Time: ${date.toISOString()}`);
      console.log(`\nContent:`);
      console.log(content);
      console.log(`\n`);
    }

    // Check messages sent by our platform wallet
    const ourWallet = '0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321';
    const ourMessages = await publicClient.readContract({
      address: contractConfig.address as `0x${string}`,
      abi: contractConfig.abi,
      functionName: 'getSenderMessages',
      args: [ourWallet as `0x${string}`]
    }) as bigint[];

    console.log(`\n📊 Our wallet (${ourWallet}) sent ${ourMessages.length} messages`);
    console.log(`Message IDs: ${ourMessages.map(id => id.toString()).join(', ')}`);

  } catch (error) {
    console.error('❌ Error reading messages:', error);
  }
}

readMessages();
