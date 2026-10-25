import { Asset, BASE_FEE, Keypair, Operation, TransactionBuilder, Horizon } from '@stellar/stellar-sdk';
import { HORIZON_URL, NETWORK, amountToUnits, buildPayment, validateSignedPayment } from './payment.js';

const FRIEND_BOT = 'https://friendbot.stellar.org';

export function createDemoWallet({horizon = new Horizon.Server(HORIZON_URL), fund = async address => {
  const response = await fetch(`${FRIEND_BOT}?addr=${encodeURIComponent(address)}`);
  if (!response.ok) throw new Error(`Friendbot funding failed (${response.status})`);
}} = {}) {
  // This disposable Testnet signing key exists only in server memory.
  const signer = Keypair.random();
  let setupPromise;
  let ready = false;
  const address = signer.publicKey();

  async function setup(issuer) {
    if (ready) return;
    if (!setupPromise) setupPromise = (async () => {
      let account;
      try { account = await horizon.loadAccount(address); }
      catch { await fund(address); account = await horizon.loadAccount(address); }
      if (!account.balances.some(balance => balance.asset_code === 'USDC' && balance.asset_issuer === issuer)) {
        const tx = new TransactionBuilder(account, {fee: BASE_FEE, networkPassphrase: NETWORK})
          .addOperation(Operation.changeTrust({asset: new Asset('USDC', issuer)}))
          .setTimeout(60).build();
        tx.sign(signer);
        await horizon.submitTransaction(tx);
      }
      ready = true;
    })().catch(error => { setupPromise = undefined; throw error; });
    await setupPromise;
  }

  async function balances(issuer) {
    if (!ready) return {address, ready: false, xlm: '0.0000000', usdc: '0.0000000'};
    const account = await horizon.loadAccount(address);
    const xlm = account.balances.find(balance => balance.asset_type === 'native')?.balance ?? '0.0000000';
    const usdc = account.balances.find(balance => balance.asset_code === 'USDC' && balance.asset_issuer === issuer)?.balance ?? '0.0000000';
    return {address, ready: true, xlm, usdc};
  }

  async function signPayment(order, config) {
    if (!ready) throw new Error('Prepare the demo wallet first');
    const balance = await balances(config.issuer);
    if (amountToUnits(balance.usdc) < amountToUnits(order.amount)) throw new Error(`Demo wallet needs ${order.amount} Testnet USDC. Fund its public address from Circle's faucet, then refresh the balance.`);
    const xdr = await buildPayment(order, address, config, horizon);
    const tx = TransactionBuilder.fromXDR(xdr, NETWORK);
    validateSignedPayment(tx, order, config);
    tx.sign(signer);
    return tx;
  }

  return {address, setup, balances, signPayment};
}
