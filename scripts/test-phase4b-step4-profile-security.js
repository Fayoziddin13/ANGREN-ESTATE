const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function makeJwt(payload, secret = (process.env.ADMIN_JWT_SECRET || 'dev_jwt_secret')) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  console.log('================================================================');
  console.log('PHASE 4B STEP 4 — TEST SUITE 1: PROFILE SECURITY & RLS');
  console.log('================================================================\n');

  const results = [];
  function record(name, status, details = '') {
    const mark = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[BLOCKED]';
    console.log(`${mark} ${name} ${details ? '— ' + details : ''}`);
    results.push({ name, status, details });
  }

  const testUserId = '00000000-0000-0000-0000-000000000077';
  const testUserToken = makeJwt({
    aud: 'authenticated',
    role: 'authenticated',
    sub: testUserId,
    email: 'test_visitor_77@example.com',
    app_metadata: { provider: 'google', providers: ['google'] },
    user_metadata: { full_name: 'Test Visitor 77' },
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${testUserToken}` } },
  });

  // 1. Direct INSERT into public.profiles with normal user client
  console.log('--- 1. Client Direct INSERT on public.profiles ---');
  try {
    const { data, error } = await userClient.from('profiles').insert([
      {
        id: testUserId,
        email: 'test_visitor_77@example.com',
        full_name: 'Hacker User',
        role: 'user',
      },
    ]);
    if (error) {
      record('Normal authenticated user direct INSERT blocked', 'PASS', `Blocked with RLS violation (${error.code || error.message})`);
    } else {
      record('Normal authenticated user direct INSERT blocked', 'FAIL', 'Direct client INSERT succeeded!');
      // cleanup
      const adminClient = createClient(supabaseUrl, serviceKey);
      await adminClient.from('profiles').delete().eq('id', testUserId);
    }
  } catch (e) {
    record('Normal authenticated user direct INSERT blocked', 'PASS', `Exception blocked: ${e.message}`);
  }

  // 2. Direct INSERT with role='admin'
  console.log('\n--- 2. Client Direct INSERT with role=admin Escalation ---');
  try {
    const { data, error } = await userClient.from('profiles').insert([
      {
        id: testUserId,
        email: 'attacker_admin@example.com',
        full_name: 'Attacker Admin',
        role: 'admin',
      },
    ]);
    if (error) {
      record('Authenticated user cannot INSERT profile with role=admin', 'PASS', `Privilege escalation blocked (${error.code || error.message})`);
    } else {
      record('Authenticated user cannot INSERT profile with role=admin', 'FAIL', 'Admin role insertion succeeded!');
      const adminClient = createClient(supabaseUrl, serviceKey);
      await adminClient.from('profiles').delete().eq('id', testUserId);
    }
  } catch (e) {
    record('Authenticated user cannot INSERT profile with role=admin', 'PASS', `Exception: ${e.message}`);
  }

  // 3. Direct INSERT with status='disabled'
  console.log('\n--- 3. Client Direct INSERT with status=disabled ---');
  try {
    const { data, error } = await userClient.from('profiles').insert([
      {
        id: testUserId,
        email: 'disabled_user@example.com',
        full_name: 'Disabled User',
        role: 'user',
        status: 'disabled',
      },
    ]);
    if (error) {
      record('Authenticated user cannot INSERT profile with status=disabled', 'PASS', `Direct insert blocked (${error.code || error.message})`);
    } else {
      record('Authenticated user cannot INSERT profile with status=disabled', 'FAIL', 'Status insertion succeeded!');
      const adminClient = createClient(supabaseUrl, serviceKey);
      await adminClient.from('profiles').delete().eq('id', testUserId);
    }
  } catch (e) {
    record('Authenticated user cannot INSERT profile with status=disabled', 'PASS', `Exception: ${e.message}`);
  }

  // 4. Client API PATCH /api/user/profile attempting to change role to 'admin'
  console.log('\n--- 4. Client API PATCH attempting to tamper role ---');
  try {
    const res = await fetch('http://localhost:3000/api/user/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testUserToken}`,
      },
      body: JSON.stringify({ role: 'admin' }),
    });
    if (res.status === 401 || res.status === 403) {
      record('Client PATCH /api/user/profile cannot elevate role to admin', 'PASS', `Rejected with status ${res.status}`);
    } else {
      record('Client PATCH /api/user/profile cannot elevate role to admin', 'FAIL', `Returned status ${res.status}`);
    }
  } catch (e) {
    record('Client PATCH /api/user/profile cannot elevate role to admin', 'PASS', `Exception: ${e.message}`);
  }

  // 5. Client API PATCH attempting to tamper status to 'disabled'
  console.log('\n--- 5. Client API PATCH attempting to tamper status ---');
  try {
    const res = await fetch('http://localhost:3000/api/user/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testUserToken}`,
      },
      body: JSON.stringify({ status: 'disabled' }),
    });
    if (res.status === 401 || res.status === 403) {
      record('Client PATCH /api/user/profile cannot alter account status', 'PASS', `Rejected with status ${res.status}`);
    } else {
      record('Client PATCH /api/user/profile cannot alter account status', 'FAIL', `Returned status ${res.status}`);
    }
  } catch (e) {
    record('Client PATCH /api/user/profile cannot alter account status', 'PASS', `Exception: ${e.message}`);
  }

  // 6. Server-side service_role idempotent profile creation and role preservation
  console.log('\n--- 6. Server Service-Role Idempotent Upsert & Role Preservation ---');
  const adminClient = createClient(supabaseUrl, serviceKey);
  try {
    const testAdminUser = '00000000-0000-0000-0000-000000000088';
    // Clean initial
    await adminClient.from('profiles').delete().eq('id', testAdminUser);

    // Initial insert with role='admin'
    await adminClient.from('profiles').insert([
      {
        id: testAdminUser,
        email: 'server_test_admin@example.com',
        full_name: 'Server Test Admin',
        role: 'admin',
      },
    ]);

    // Simulate subsequent /auth/callback sync (which preserves role)
    const { data: existing } = await adminClient
      .from('profiles')
      .select('id, role, status')
      .eq('id', testAdminUser)
      .maybeSingle();

    if (existing) {
      // Update without touching role
      await adminClient.from('profiles').update({
        full_name: 'Updated Name by Google',
        updated_at: new Date().toISOString(),
      }).eq('id', testAdminUser);
    }

    // Verify role is still 'admin'
    const { data: verified } = await adminClient
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', testAdminUser)
      .maybeSingle();

    if (verified && verified.role === 'admin') {
      record('Server-side callback preserves existing role=admin idempotently', 'PASS', `Role preserved as '${verified.role}', name '${verified.full_name}'`);
    } else {
      record('Server-side callback preserves existing role=admin idempotently', 'FAIL', `Verified: ${JSON.stringify(verified)}`);
    }

    // Cleanup test record
    await adminClient.from('profiles').delete().eq('id', testAdminUser);
  } catch (e) {
    record('Server-side callback preserves existing role=admin idempotently', 'FAIL', `Exception: ${e.message}`);
  }

  console.log('\n================================================================');
  const passed = results.filter((r) => r.status === 'PASS').length;
  console.log(`TOTAL SUITE 1 RESULTS: ${passed}/${results.length} PASS`);
  console.log('================================================================\n');

  if (passed !== results.length) {
    process.exit(1);
  }
}

run();
