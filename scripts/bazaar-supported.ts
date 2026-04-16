import { createFacilitatorConfig } from '@coinbase/x402';

async function main() {
  const cdpKeyId = process.env.CDP_API_KEY_ID;
  const cdpSecret = process.env.CDP_PRIVATE_KEY;
  
  const cfg = createFacilitatorConfig(cdpKeyId, cdpSecret);
  const authHeaders = await cfg.createAuthHeaders();
  
  const BAZAAR_URL = 'https://api.cdp.coinbase.com/platform/v2/x402';
  
  const resp = await fetch(BAZAAR_URL + '/supported', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeaders as any).supported
    }
  });
  
  console.log('Status:', resp.status);
  const data = await resp.json();
  console.log(JSON.stringify(data, null, 2).slice(0, 3000));
}

main().catch(console.error);
