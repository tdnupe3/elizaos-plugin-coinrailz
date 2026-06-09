/**
 * Compile CoinRailzYieldVault.sol using the bundled solc 0.8.30
 * Output: contracts/CoinRailzYieldVault.json
 */
const solc = require('solc');
const fs   = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../contracts/CoinRailzYieldVault.sol'), 'utf8');

const input = JSON.stringify({
  language: 'Solidity',
  sources: { 'CoinRailzYieldVault.sol': { content: src } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    outputSelection: {
      'CoinRailzYieldVault.sol': {
        CoinRailzYieldVault: ['abi', 'evm.bytecode.object'],
      },
    },
  },
});

console.log('Compiling with solc', solc.version(), '...');
const output = JSON.parse(solc.compile(input));

if (output.errors) {
  const fatal = output.errors.filter(e => e.severity === 'error');
  if (fatal.length) {
    console.error('COMPILATION ERRORS:');
    fatal.forEach(e => console.error(e.formattedMessage));
    process.exit(1);
  }
  const warnings = output.errors.filter(e => e.severity === 'warning');
  if (warnings.length) {
    console.warn('Warnings:');
    warnings.forEach(w => console.warn(w.formattedMessage));
  }
}

const contract = output.contracts['CoinRailzYieldVault.sol']['CoinRailzYieldVault'];
if (!contract) {
  console.error('Contract not found in output');
  process.exit(1);
}

const artifact = {
  contractName: 'CoinRailzYieldVault',
  abi:      contract.abi,
  bytecode: '0x' + contract.evm.bytecode.object,
  compiler: solc.version(),
};

const outPath = path.join(__dirname, '../contracts/CoinRailzYieldVault.json');
fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2));

console.log('✅ Compiled successfully');
console.log('   ABI entries:', artifact.abi.length);
console.log('   Bytecode size:', (artifact.bytecode.length - 2) / 2, 'bytes');
console.log('   Output:', outPath);
