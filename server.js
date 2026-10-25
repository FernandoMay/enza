import http from 'node:http';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Horizon } from '@stellar/stellar-sdk';
import { CATALOG, HORIZON_URL, NETWORK, configFromEnv, createOrder, verifyPayment } from './payment.js';
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
const publicOrder=o=>({id:o.id,itemId:o.itemId,kind:o.kind,amount:o.amount,status:o.status,expiresAt:o.expiresAt,memo:o.memo,hash:o.hash,ticket:o.ticket,explorer:o.hash?`https://stellar.expert/explorer/testnet/tx/${o.hash}`:null});
export async function handleRequest(req,res){
 try {
  if(req.method==='POST'&&req.headers?.origin&&req.headers.origin!==`http://127.0.0.1:${process.env.PORT||3000}`)throw Error('Use the local ENZA demo page to authorize a payment');
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&url.pathname==='/api/config'){let paymentConfig;try{paymentConfig=configFromEnv()}catch{}return send(res,200,{network:'Testnet',networkPassphrase:NETWORK,configured:!!paymentConfig,issuer:paymentConfig?.issuer??null,merchant:paymentConfig?.merchant??null,items:Object.entries(CATALOG).map(([id,v])=>({id,name:v.name,kind:v.kind,amount:(Number(v.units)/1e7).toFixed(2)}))})}
  if(req.method==='GET'&&url.pathname==='/api/demo-wallet'){const config=configFromEnv();return send(res,200,await demoWallet.balances(config.issuer))}
  if(req.method==='POST'&&url.pathname==='/api/demo-wallet/setup'){const config=configFromEnv();await demoWallet.setup(config.issuer);return send(res,200,await demoWallet.balances(config.issuer))}
  if(req.method==='POST'&&url.pathname==='/api/orders'){const data=await body(req);configFromEnv();const order=createOrder(data.itemId);orders[order.id]=order;save();return send(res,201,publicOrder(order))}
  const match=url.pathname.match(/^\/api\/orders\/([0-9a-f-]+)(?:\/(pay|confirm))?$/);
  if(match){const order=orders[match[1]];if(!order)return send(res,404,{error:'Order not found'});
   if(req.method==='GET'&&!match[2])return send(res,200,publicOrder(order));
   if(req.method==='POST'&&match[2]==='pay'){
    if(order.status==='paid')return send(res,200,{hash:order.hash});
    if(order.hash)return send(res,200,{hash:order.hash});
    if(Date.now()>=Date.parse(order.expiresAt))throw Error('Order expired. Select the sample again.');
    if(!pendingPayments.has(order.id)){
     const work=(async()=>{
      const tx=await demoWallet.signPayment(order,configFromEnv());
      const hash=tx.hash().toString('hex');
      order.hash=hash;save();
      await horizon.submitTransaction(tx);
      return {hash};
     })().finally(()=>pendingPayments.delete(order.id));
     pendingPayments.set(order.id,work);
    }
    return send(res,200,await pendingPayments.get(order.id));
   }
   if(req.method==='POST'&&match[2]==='confirm'){const {hash}=await body(req);if(order.status==='paid'&&order.hash===hash)return send(res,200,publicOrder(order));if(order.hash!==hash)throw Error('Hash does not match this order');const tx=await horizon.transactions().transaction(hash).call();const ops=await horizon.operations().forTransaction(hash).limit(200).call();const updated=verifyPayment(order,hash,tx,ops.records,configFromEnv(),new Set(Object.values(orders).filter(o=>o.id!==order.id&&o.hash).map(o=>o.hash)));orders[order.id]=updated;save();return send(res,200,publicOrder(updated))}
  }
  if(req.method==='GET'&&servePage(url.pathname,res))return;
  send(res,404,{error:'Not found'});
 }catch(e){send(res,400,{error:e.message||'Request failed'})}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 http.createServer(handleRequest).listen(Number(process.env.PORT||3000),'127.0.0.1',()=>console.log('ENZA Movement demo listening on http://127.0.0.1:'+String(process.env.PORT||3000)));
}
