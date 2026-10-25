import http from 'node:http';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { Horizon, TransactionBuilder, StrKey } from '@stellar/stellar-sdk';
import { CATALOG, HORIZON_URL, NETWORK, configFromEnv, createOrder, buildPayment, verifyPayment } from './payment.js';
const dbPath=new URL('./.data/orders.json',import.meta.url);
mkdirSync(new URL('./.data/',import.meta.url),{recursive:true});
let orders=existsSync(dbPath)?JSON.parse(readFileSync(dbPath,'utf8')):{};
const save=()=>{writeFileSync(new URL('./.data/orders.tmp',import.meta.url),JSON.stringify(orders));renameSync(new URL('./.data/orders.tmp',import.meta.url),dbPath)};
const horizon=new Horizon.Server(HORIZON_URL);
const send=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json','access-control-allow-origin':'http://127.0.0.1:5173'});res.end(JSON.stringify(data))};
const body=async req=>{let s='';for await(const chunk of req){s+=chunk;if(s.length>20000)throw Error('Request too large')}return JSON.parse(s||'{}')};
const publicOrder=o=>({id:o.id,itemId:o.itemId,kind:o.kind,amount:o.amount,status:o.status,expiresAt:o.expiresAt,hash:o.hash,ticket:o.ticket,explorer:o.hash?`https://stellar.expert/explorer/testnet/tx/${o.hash}`:null});
http.createServer(async(req,res)=>{
 try {
  if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':'http://127.0.0.1:5173','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'});return res.end()}
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&url.pathname==='/api/config') return send(res,200,{network:'Testnet',networkPassphrase:NETWORK,configured:!!(process.env.STELLAR_USDC_TESTNET_ISSUER&&process.env.STELLAR_MERCHANT_ADDRESS),items:Object.entries(CATALOG).map(([id,v])=>({id,name:v.name,kind:v.kind,amount:(Number(v.units)/1e7).toFixed(2)}))});
  if(req.method==='POST'&&url.pathname==='/api/orders'){const data=await body(req);configFromEnv();const order=createOrder(data.itemId);orders[order.id]=order;save();return send(res,201,publicOrder(order))}
  if(req.method==='POST'&&url.pathname==='/api/submit'){
   const {orderId,xdr}=await body(req);const order=orders[orderId], config=configFromEnv();
   if(!order||order.status!=='pending'||Date.now()>=Date.parse(order.expiresAt))throw Error('Pending order required');
   const tx=TransactionBuilder.fromXDR(xdr,NETWORK);
   if(tx.memo?.type!=='text'||tx.memo.value!==order.memo||tx.operations.length!==1)throw Error('Transaction does not match order');
   const op=tx.operations[0];
   if(op.type!=='payment'||op.destination!==config.merchant||op.asset.code!=='USDC'||op.asset.issuer!==config.issuer||op.amount!==order.amount)throw Error('Payment details changed');
   if(!StrKey.isValidEd25519PublicKey(tx.source))throw Error('Invalid source');
   const result=await horizon.submitTransaction(tx);return send(res,200,{hash:result.hash});
  }
  const match=url.pathname.match(/^\/api\/orders\/([0-9a-f-]+)(?:\/(prepare|confirm))?$/);
  if(match){const order=orders[match[1]];if(!order)return send(res,404,{error:'Order not found'});
   if(req.method==='GET'&&!match[2])return send(res,200,publicOrder(order));
   if(req.method==='POST'&&match[2]==='prepare'){const {source}=await body(req);return send(res,200,{xdr:await buildPayment(order,source,configFromEnv(),horizon)})}
   if(req.method==='POST'&&match[2]==='confirm'){const {hash}=await body(req);if(order.status==='paid'&&order.hash===hash)return send(res,200,publicOrder(order));const tx=await horizon.transactions().transaction(hash).call();const ops=await horizon.operations().forTransaction(hash).limit(200).call();const updated=verifyPayment(order,hash,tx,ops.records,configFromEnv(),new Set(Object.values(orders).filter(o=>o.id!==order.id&&o.hash).map(o=>o.hash)));orders[order.id]=updated;save();return send(res,200,publicOrder(updated))}
  }
  send(res,404,{error:'Not found'});
 }catch(e){send(res,400,{error:e.message||'Request failed'})}
}).listen(Number(process.env.PORT||3000),'127.0.0.1',()=>console.log('ENZA demo API listening on 127.0.0.1:'+String(process.env.PORT||3000)));
