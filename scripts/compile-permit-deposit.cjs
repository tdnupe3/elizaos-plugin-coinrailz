/**
 * Compile PermitAndDeposit.sol using the bundled solc 0.8.30
 * Output: contracts/PermitAndDeposit.json
 */
const solc  = require('solc');
const fs    = require('fs');
const path  = require('path');

const src = fs.readFileSync(path.join(__dirname, '../contracts/PermitAndDeposit.sol'), 'utf8');

const input = JSON.stringify({
  language: 'Solidity',
  sources: { 'PermitAndDeposit.sol': { content: src } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      'PermitAndDeposit.sol': {
        PermitAndDeposit: ['abi', 'evm.bytecode.object'],
      },
    },
  },
});

console.log('Compiling PermitAndDeposit.sol with solc', solc.version(), '...');
const output = JSON.parse(solc.compile(input));

if (output.errors) {
  const fatal = output.errors.filter(e => e.severity === 'error');
  if (fatal.length) {
    console.error('COMPILATION ERRORS:');
    fatal.forEach(e => console.error(e.formattedMessage));
    process.exit(1);
  }
  output.errors.filter(e => e.severity === 'warning').forEach(w => console.warn(w.formattedMessage));
}

const contract = output.contracts['PermitAndDeposit.sol']['PermitAndDeposit'];
if (!contract) { console.error('Contract not found in output'); process.exit(1); }

const artifact = {
  contractName: 'PermitAndDeposit',
  abi:      contract.abi,
  bytecode: '0x' + contract.evm.bytecode.object,
  compiler: solc.version(),
};

const outPath = path.join(__dirname, '../contracts/PermitAndDeposit.json');
fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2));

console.log('✅ Compiled PermitAndDeposit.sol');
console.log('   ABI entries:', artifact.abi.length);
console.log('   Bytecode size:', (artifact.bytecode.length - 2) / 2, 'bytes');
console.log('   Output:', outPath);
