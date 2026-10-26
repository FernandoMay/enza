import http from 'node:http';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Horizon, Keypair } from '@stellar/stellar-sdk';
import { CATALOG, HORIZON_URL, NETWORK, configFromEnv, createOrder } from './payment.js';
import { checkoutConfigFromEnv, createCheckoutService, orderOnChainId, verifySorobanSettlement } from './soroban.js';
import { createDemoWallet } from './demo-wallet.js';
const dbPath=new URL('./.data/orders.json',import.meta.url);
const distUrl=new URL('./dist/',import.meta.url);
mkdirSync(new URL('./.data/',import.meta.url),{recursive:true});
let orders=existsSync(dbPath)?JSON.parse(readFileSync(dbPath,'utf8')):{};
const save=()=>{writeFileSync(new URL('./.data/orders.tmp',import.meta.url),JSON.stringify(orders));renameSync(new URL('./.data/orders.tmp',import.meta.url),dbPath)};
const horizon=new Horizon.Server(HORIZON_URL);
const demoWallet=createDemoWallet({horizon});
const pendingPayments=new Map();
const send=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data))};
const servePage=(pathname,res)=>{
 const path=pathname==='/'?'/index.html':pathname;
 if(!['/index.html','/demo.html','/blueprint.html'].includes(path)&&!/^\/assets\/[a-zA-Z0-9._-]+$/.test(path))return false;
 const file=new URL('.'+path,distUrl);
 if(!existsSync(file)){send(res,404,{error:'Build the demo with npm run build first'});return true}
 const type={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'}[extname(path)]||'application/octet-stream';
 res.writeHead(200,{'content-type':type,'cache-control':'no-store'});res.end(readFileSync(file));return true;
};
const body=async req=>{let s='';for await(const chunk of req){s+=chunk;if(s.length>20000)throw Error('Request too large')}return JSON.parse(s||'{}')};
const publicOrder=o=>({id:o.id,itemId:o.itemId,kind:o.kind,amount:o.amount,status:o.status,expiresAt:o.expiresAt,hash:o.hash,customer:o.customer,paidAt:o.paidAt,ticket:o.ticket,soroban:o.soroban?{onChainId:o.soroban.onChainId,contractId:o.soroban.contractId,token:o.soroban.token,merchant:o.soroban.merchant}:null,explorer:o.hash?`https://stellar.expert/explorer/testnet/tx/${o.hash}`:null});
const usedHashes=excludeId=>new Set(Object.values(orders).filter(o=>o.id!==excludeId&&o.hash).map(o=>o.hash));

// Lazily initialized Soroban checkout service. It reads configuration and the
// operator signing key once per process; the key stays in memory only.
let checkout=null;
async function getCheckout(){
 if(checkout)return checkout;
 const config=checkoutConfigFromEnv();
 const secret=process.env.STELLAR_CHECKOUT_OPERATOR_SECRET;
 if(!secret)throw Error('Configure the Testnet operator key (STELLAR_CHECKOUT_OPERATOR_SECRET) to create checkout orders');
 const operatorKeypair=Keypair.fromSecret(secret);
 const service=await createCheckoutService(config);
 const deployment=await service.assertDeployment();
 checkout={config,deployment,service,operatorKeypair};
 return checkout;
}

export async function handleRequest(req,res){
 try {
  if(req.method==='POST'&&req.headers?.origin&&req.headers.origin!==`http://127.0.0.1:${process.env.PORT||3000}`)throw Error('Use the local ENZA demo page to authorize a payment');
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&url.pathname==='/api/config'){
   let paymentConfig;try{paymentConfig=configFromEnv()}catch{}
   let checkoutInfo;try{const c=checkoutConfigFromEnv();checkoutInfo={contractId:c.contractId,networkPassphrase:c.passphrase}}catch{}
   return send(res,200,{network:'Testnet',networkPassphrase:NETWORK,configured:!!paymentConfig,issuer:paymentConfig?.issuer??null,merchant:paymentConfig?.merchant??null,checkout:checkoutInfo??null,operatorConfigured:!!process.env.STELLAR_CHECKOUT_OPERATOR_SECRET,items:Object.entries(CATALOG).map(([id,v])=>({id,name:v.name,kind:v.kind,amount:(Number(v.units)/1e7).toFixed(2)}))});
  }
  if(req.method==='GET'&&url.pathname==='/api/checkout'){
   const {deployment}=await getCheckout();
   return send(res,200,{network:'Testnet',...deployment});
  }
  if(req.method==='GET'&&url.pathname==='/api/demo-wallet'){const config=configFromEnv();return send(res,200,await demoWallet.balances(config.issuer))}
  if(req.method==='POST'&&url.pathname==='/api/demo-wallet/setup'){const config=configFromEnv();await demoWallet.setup(config.issuer);return send(res,200,await demoWallet.balances(config.issuer))}

  if(req.method==='POST'&&url.pathname==='/api/orders'){
   const data=await body(req);
   const {config,deployment,service,operatorKeypair}=await getCheckout();
   configFromEnv();
   const order=createOrder(data.itemId);
   order.customer=null;
   order.soroban={onChainId:orderOnChainId(order.id),contractId:deployment.contractId,token:deployment.token,merchant:deployment.merchant};
   await service.createOnChainOrder(order,operatorKeypair);
   orders[order.id]=order;save();
   return send(res,201,publicOrder(order));
  }

  const match=url.pathname.match(/^\/api\/orders\/([0-9a-f-]+)(?:\/(intent|pay|confirm|submit))?$/);
  if(match){
   const order=orders[match[1]];if(!order)return send(res,404,{error:'Order not found'});
   const {service}=await getCheckout();
   if(req.method==='GET'&&!match[2])return send(res,200,publicOrder(order));

   if(req.method==='POST'&&match[2]==='intent'){
    if(order.status==='paid')return send(res,200,{alreadyPaid:true,hash:order.hash});
    if(Date.now()>=Date.parse(order.expiresAt))throw Error('Order expired. Select the sample again.');
    if(order.hash)return send(res,200,{alreadySubmitted:true,xdr:null});
    const data=await body(req);
    const customer=String(data?.customer||'');
    if(order.customer&&order.customer!==customer)throw Error('This order is already assigned to another customer');
    const intent=await service.buildUnsignedPayment(order,customer);
    order.customer=customer;save();
    return send(res,200,{xdr:intent.xdr,networkPassphrase:intent.networkPassphrase});
   }

   if(req.method==='POST'&&match[2]==='submit'){
    if(order.status==='paid')return send(res,200,{alreadyPaid:true,hash:order.hash});
    if(!order.customer)throw Error('Create the payment intent before submitting');
    if(order.hash)return send(res,200,{alreadySubmitted:true,hash:order.hash});
    if(Date.now()>=Date.parse(order.expiresAt))throw Error('Order expired. Select the sample again.');
    const data=await body(req);
    const {hash,txStatus}=await service.submitSignedPayment({order,customerAddress:order.customer,signedXdr:String(data?.signedXdr||''),usedHashes:usedHashes(order.id)});
    if(txStatus!=='SUCCESS')throw Error('Transaction failed on-chain. No payment was recorded; start a new order.');
    if(order.hash&&order.hash!==hash)throw Error('Transaction already used');
    order.hash=hash;save();
    return send(res,200,{hash});
   }

   if(req.method==='POST'&&match[2]==='pay'){
    if(order.status==='paid')return send(res,200,{hash:order.hash});
    if(order.hash)return send(res,200,{hash:order.hash});
    if(Date.now()>=Date.parse(order.expiresAt))throw Error('Order expired. Select the sample again.');
    if(!pendingPayments.has(order.id)){
     const work=(async()=>{
      const {service,config}=await getCheckout();
      await demoWallet.setup(config.issuer);
      await demoWallet.ensureFunds(order,config.issuer);
      const intent=await service.buildUnsignedPayment(order,demoWallet.address);
      order.customer=demoWallet.address;save();
      const signedXdr=demoWallet.signTransaction(intent.xdr,intent.networkPassphrase);
      const {hash}=await service.submitSignedPayment({order,customerAddress:order.customer,signedXdr,usedHashes:usedHashes(order.id)});
      order.hash=hash;save();
      return {hash};
     })().finally(()=>pendingPayments.delete(order.id));
     pendingPayments.set(order.id,work);
    }
    return send(res,200,await pendingPayments.get(order.id));
   }

   if(req.method==='POST'&&match[2]==='confirm'){
    const {hash}=await body(req);
    if(order.status==='paid'&&order.hash===hash)return send(res,200,publicOrder(order));
    if(order.hash!==hash)throw Error('Hash does not match this order');
    const [onchain,txInfo]=await Promise.all([service.readOrder(order.soroban.onChainId),service.getTransaction(hash)]);
    const updated=verifySorobanSettlement(order,{hash,txStatus:txInfo.status,onchain},usedHashes(order.id));
    orders[order.id]=updated;save();
    return send(res,200,publicOrder(updated));
   }
  }
  if(req.method==='GET'&&servePage(url.pathname,res))return;
  send(res,404,{error:'Not found'});
 }catch(e){send(res,400,{error:e.message||'Request failed'})}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 http.createServer(handleRequest).listen(Number(process.env.PORT||3000),'127.0.0.1',()=>console.log('ENZA Movement demo listening on http://127.0.0.1:'+String(process.env.PORT||3000)));
}
