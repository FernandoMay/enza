import test from 'node:test';
import assert from 'node:assert/strict';
import { Account, Keypair } from '@stellar/stellar-sdk';
import { createDemoWallet } from '../demo-wallet.js';
import { createOrder, validateSignedPayment } from '../payment.js';

test('disposable wallet funds, trusts USDC, and signs the exact Testnet demo payment', async () => {
  const issuer=Keypair.random().publicKey(), merchant=Keypair.random().publicKey();
  let funded=false, trusted=false, friendbotCalls=0, trustSubmissions=0;
  const account=(address,balances)=>Object.assign(new Account(address,'1'),{balances});
  const horizon={
    async loadAccount(address) {
      if(address===merchant)return account(address,[{asset_code:'USDC',asset_issuer:issuer,balance:'0.0000000'}]);
      if(!funded)throw Error('Account not found');
      return account(address,[{asset_type:'native',balance:'100.0000000'},...(trusted?[{asset_code:'USDC',asset_issuer:issuer,balance:'15.0000000'}]:[])]);
    },
    async submitTransaction(tx) {
      assert.equal(tx.operations[0].type,'changeTrust');
      assert.equal(tx.operations[0].line.issuer,issuer);
      trustSubmissions++;
      trusted=true;
      return {hash:'a'.repeat(64)};
    }
  };
  const wallet=createDemoWallet({horizon,async fund(address){assert.equal(address,wallet.address);friendbotCalls++;funded=true}});
  assert.equal((await wallet.balances(issuer)).ready,false);
  await Promise.all([wallet.setup(issuer),wallet.setup(issuer)]);
  assert.equal(friendbotCalls,1);
  assert.equal(trustSubmissions,1);
  assert.equal((await wallet.balances(issuer)).usdc,'15.0000000');
  const order=createOrder('bottle');
  const tx=await wallet.signPayment(order,{issuer,merchant});
  assert.equal(tx.source,wallet.address);
  assert.equal(tx.signatures.length,1);
  assert.doesNotThrow(()=>validateSignedPayment(tx,order,{issuer,merchant}));
  assert.equal(JSON.stringify(wallet),JSON.stringify({address:wallet.address}));
});
