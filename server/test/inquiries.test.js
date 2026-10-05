import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { validateInquiry } from '../src/routes/inquiries.js';
import { TravelInquiry } from '../src/models/TravelInquiry.js';
const request = {kind:'hotel',name:'Traveller',email:'PERSON@example.com',destination:'Antalya',startDate:'2099-01-01',endDate:'2099-01-03',adults:2};
test('requests validate real dates and hotel nights and do not accept payment fields',()=>{
 assert.equal(validateInquiry({...request,total:123,transactionHash:'untrusted'}).total,undefined);
 assert.equal(validateInquiry(request).email,'person@example.com');
 for (const invalid of [{startDate:'2099-02-30'},{endDate:'2099-01-01'},{adults:0},{email:'invalid'},{kind:'other'},{name:{malicious:true}}]) assert.throws(()=>validateInquiry({...request,...invalid}));
 assert.equal(validateInquiry({...request,kind:'flight',origin:'Antalya',endDate:''}).endDate,'');
});
test('public request is stored with a reference while all legacy payment entrypoints are blocked',async()=>{
 const original = TravelInquiry.create; let saved;
 TravelInquiry.create = async value => {saved=value; return {...value,status:'new'};};
 const server = createApp().listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
 const url = `http://127.0.0.1:${server.address().port}`;
 try {
  const result = await fetch(`${url}/api/inquiries`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
  assert.equal(result.status,201); const data=await result.json(); assert.match(data.reference,/^RV-/); assert.equal(data.status,'new'); assert.equal(saved.destination,'Antalya');
  for (const path of ['/hotels/card/session','/hotels/card/reference/finalize','/hotels/prebook','/hotels/checkout','/hotels/crypto-checkout','/hotels/reference/verify-payment','/flights/checkout','/flights/reference/finalize']) {
   assert.equal((await fetch(`${url}/api${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,409,path);
  }
 } finally {TravelInquiry.create=original; await new Promise(resolve=>server.close(resolve));}
});
test('admin enquiries require owner authentication and audit status updates',async()=>{
 const {CustomerSession}=await import('../src/models/CustomerSession.js');
 const {TravelAdminAudit}=await import('../src/models/TravelAdmin.js');
 const oldEmail=process.env.ROTAVOY_ADMIN_EMAILS;
 const originals={session:CustomerSession.findOne,find:TravelInquiry.find,count:TravelInquiry.countDocuments,update:TravelInquiry.findOneAndUpdate,audit:TravelAdminAudit.create};
 process.env.ROTAVOY_ADMIN_EMAILS='owner@example.com';
 let identity={provider:'firebase',email:'other@example.com',emailVerified:true}; let audit;
 CustomerSession.findOne=()=>({populate:async()=>({customer:identity,lastUsedAt:new Date()})});
 const item={...request,reference:'RV-fixture',status:'new'};
 TravelInquiry.find=()=>({sort:()=>({skip:()=>({limit:()=>({lean:async()=>[item]})})})});
 TravelInquiry.countDocuments=async()=>1;
 TravelInquiry.findOneAndUpdate=(filter,change)=>({lean:async()=>({...item,...change,reference:filter.reference})});
 TravelAdminAudit.create=async value=>{audit=value;return value;};
 const server=createApp().listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const url=`http://127.0.0.1:${server.address().port}/api/admin/inquiries`;
 try{
  assert.equal((await fetch(url)).status,401);
  const headers={Authorization:'Bearer fixture-token','Content-Type':'application/json'};
  assert.equal((await fetch(url,{headers})).status,403);
  identity={...identity,email:'owner@example.com'};
  const list=await fetch(url,{headers});assert.equal(list.status,200);assert.equal((await list.json()).items[0].reference,'RV-fixture');
  assert.equal((await fetch(`${url}/RV-fixture`,{method:'PUT',headers,body:JSON.stringify({status:'confirmed'})})).status,400);
  const update=await fetch(`${url}/RV-fixture`,{method:'PUT',headers,body:JSON.stringify({status:'contacted'})});assert.equal(update.status,200);assert.equal((await update.json()).item.status,'contacted');assert.equal(audit.action,'inquiry.status');
 }finally{
  CustomerSession.findOne=originals.session;TravelInquiry.find=originals.find;TravelInquiry.countDocuments=originals.count;TravelInquiry.findOneAndUpdate=originals.update;TravelAdminAudit.create=originals.audit;
  if(oldEmail===undefined)delete process.env.ROTAVOY_ADMIN_EMAILS;else process.env.ROTAVOY_ADMIN_EMAILS=oldEmail;
  await new Promise(r=>server.close(r));
 }
});
