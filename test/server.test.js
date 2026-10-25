import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../server.js';

test('public demo config exposes exact Testnet payment details', async () => {
  const issuer = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
  const merchant = 'GC4WBX5KJPBFPOBXS7RJTKO5ISYDBP7GZY7JJGS6GC7737A7LD6HGKFM';
  const previousIssuer = process.env.STELLAR_USDC_TESTNET_ISSUER;
  const previousMerchant = process.env.STELLAR_MERCHANT_ADDRESS;
  process.env.STELLAR_USDC_TESTNET_ISSUER = issuer;
  process.env.STELLAR_MERCHANT_ADDRESS = merchant;
  let code;
  let payload;
  const response = { writeHead(status) { code = status; }, end(body) { payload = body; } };
  try {
    await handleRequest({ method: 'GET', url: '/api/config' }, response);
  } finally {
    if (previousIssuer === undefined) delete process.env.STELLAR_USDC_TESTNET_ISSUER;
    else process.env.STELLAR_USDC_TESTNET_ISSUER = previousIssuer;
    if (previousMerchant === undefined) delete process.env.STELLAR_MERCHANT_ADDRESS;
    else process.env.STELLAR_MERCHANT_ADDRESS = previousMerchant;
  }
  const config = JSON.parse(payload);
  assert.equal(code, 200);
  assert.equal(config.network, 'Testnet');
  assert.equal(config.configured, true);
  assert.equal(config.issuer, issuer);
  assert.equal(config.merchant, merchant);
  assert.deepEqual(config.items.map(item => item.id), ['bottle', 'antidote']);
});
