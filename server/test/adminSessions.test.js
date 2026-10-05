import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { CustomerSession } from '../src/models/CustomerSession.js';
import { createCustomerSession } from '../src/services/customerAuthService.js';
test('separate admin and customer tokens survive logout of the other session', async () => {
  const previous = process.env.ROTAVOY_ADMIN_EMAILS; process.env.ROTAVOY_ADMIN_EMAILS = 'owner@example.com';
  const real = {create:CustomerSession.create,find:CustomerSession.findOne,remove:CustomerSession.deleteOne};
  let sequence = 0;
  const sessions = new Map(); const customer = {_id:'customer-fixture',provider:'firebase',providerId:'google-fixture',email:'owner@example.com',emailVerified:true};
  CustomerSession.create = async body => { const stored = {...body,_id:`session-${sequence++}`,customer,lastUsedAt:new Date()}; sessions.set(body.tokenHash,stored); return stored; };
  CustomerSession.findOne = filter => ({populate:async()=>sessions.get(filter.tokenHash) || null});
  CustomerSession.deleteOne = async filter => { for(const [key,item] of sessions) if(item._id===filter._id) sessions.delete(key); };
  const server=createApp().listen(0);await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const site=await createCustomerSession(customer); const admin=await createCustomerSession(customer);
    assert.notEqual(site.token,admin.token);
    const request=(path,token,method='GET')=>fetch(`${base}${path}`,{method,headers:{Authorization:`Bearer ${token}`}});
    assert.equal((await request('/api/customer-auth/logout',site.token,'POST')).status,204);
    assert.equal((await request('/api/admin/session',admin.token)).status,200);
    const secondSite=await createCustomerSession(customer);
    assert.equal((await request('/api/customer-auth/logout',admin.token,'POST')).status,204);
    assert.equal((await request('/api/customer-auth/session',secondSite.token)).status,200);
    assert.equal((await fetch(`${base}/api/admin-auth/google`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:'invalid'})})).status,401);
  } finally {CustomerSession.create=real.create;CustomerSession.findOne=real.find;CustomerSession.deleteOne=real.remove;if(previous===undefined)delete process.env.ROTAVOY_ADMIN_EMAILS;else process.env.ROTAVOY_ADMIN_EMAILS=previous;await new Promise(resolve=>server.close(resolve));}
});
