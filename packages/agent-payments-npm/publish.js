const { execSync } = require('child_process');

try {
  const result = execSync('npm publish --access public', { 
    encoding: 'utf8', 
    stdio: 'pipe',
    cwd: __dirname 
  });
  console.log('SUCCESS:', result);
} catch (e) {
  console.log('OUTPUT:', e.stdout);
  console.log('ERROR:', e.stderr);
  process.exit(e.status || 1);
}
