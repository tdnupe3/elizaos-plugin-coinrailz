import { HDKey } from "@scure/bip32";
import { privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";

// Load wallet data
const walletData = JSON.parse(fs.readFileSync("server/wallets/x402-test-wallet.json", "utf-8"));
console.log("CDP Address:", walletData.address);

const seedHex = walletData.exportData.seed;
console.log("Seed hex:", seedHex.slice(0, 10) + "...");
console.log("Seed length:", seedHex.length);

const seedBytes = Buffer.from(seedHex, "hex");
console.log("Seed bytes length:", seedBytes.length);

// Create HD wallet from seed
const hdKey = HDKey.fromMasterSeed(seedBytes);
console.log("HD Key created");

// Derive using Ethereum path: m/44'/60'/0'/0/0
const derivedKey = hdKey.derive("m/44'/60'/0'/0/0");
console.log("Key derived");

if (!derivedKey.privateKey) {
  console.log("ERROR: No private key in derived key");
  process.exit(1);
}

const privateKeyHex = `0x${Buffer.from(derivedKey.privateKey).toString("hex")}` as `0x${string}`;
console.log("Private key derived (first 10 chars):", privateKeyHex.slice(0, 12) + "...");

// Get address from private key using viem
const account = privateKeyToAccount(privateKeyHex);
console.log("Derived address:", account.address);
console.log("CDP address:    ", walletData.address);
console.log("Match:", account.address.toLowerCase() === walletData.address.toLowerCase());
