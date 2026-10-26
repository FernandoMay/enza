import { randomUUID } from 'node:crypto';
import { Networks, StrKey } from '@stellar/stellar-sdk';

export const HORIZON_URL = 'https://horizon-testnet.stellar.org';
export const NETWORK = Networks.TESTNET;
export const CATALOG = Object.freeze({
  bottle: { name: 'Reusable bottle (sample product)', kind: 'product', units: 50000000n },
  antidote: { name: 'ENZA-hosted sound healing session (demo ticket)', kind: 'event', units: 100000000n }
});
export const unitsToAmount = units => `${units / 10000000n}.${(units % 10000000n).toString().padStart(7,'0')}`;
export function amountToUnits(value) {
  if (!/^(0|[1-9]\d*)(\.\d{1,7})?$/.test(value)) throw new Error('Invalid Stellar amount');
  const [whole, fraction=''] = value.split('.');
  return BigInt(whole)*10000000n + BigInt(fraction.padEnd(7,'0'));
}
export function configFromEnv(env=process.env) {
  const issuer=env.STELLAR_USDC_TESTNET_ISSUER, merchant=env.STELLAR_MERCHANT_ADDRESS;
  if (!issuer || !merchant || !StrKey.isValidEd25519PublicKey(issuer) || !StrKey.isValidEd25519PublicKey(merchant)) throw new Error('Configure valid Testnet USDC issuer and merchant public address');
  return {issuer,merchant};
}
export function createOrder(itemId) {
  const item=CATALOG[itemId]; if (!item) throw new Error('Unknown sample item');
  return {id:randomUUID(),itemId,kind:item.kind,amount:unitsToAmount(item.units),status:'pending',createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+15*60_000).toISOString(),memo:randomUUID().replaceAll('-','').slice(0,28),hash:null,customer:null,ticket:null};
}
