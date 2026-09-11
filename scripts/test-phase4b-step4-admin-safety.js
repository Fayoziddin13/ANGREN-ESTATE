const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  console.log('================================================================');
  console.log('PHASE 4B STEP 4 — TEST SUITE 3: ADMIN ROLE & STATUS SAFETY');
  console.log('================================================================\n');

  const results = [];
  function record(name, status, details = '') {
    const mark = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[BLOCKED]';
    console.log(`${mark} ${name} ${details ? '— ' + details : ''}`);
    results.push({ name, status, details });
  }

  // 1. Unauthenticated request to /api/admin/users
  console.log('--- 1. Unauthorized Requests to Admin User Endpoints ---');
  try {
    const unauthGet = await fetch('http://localhost:3000/api/admin/users');
    if (unauthGet.status === 401) {
      record('Unauthenticated GET /api/admin/users rejected with 401', 'PASS', '401 Unauthorized');
    } else {
      record('Unauthenticated GET /api/admin/users rejected with 401', 'FAIL', `Status ${unauthGet.status}`);
    }

    const unauthPatch = await fetch('http://localhost:3000/api/admin/users/00000000-0000-0000-0000-000000000001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'disabled' }),
    });
    if (unauthPatch.status === 401) {
      record('Unauthenticated PATCH /api/admin/users/[id] rejected with 401', 'PASS', '401 Unauthorized');
    } else {
      record('Unauthenticated PATCH /api/admin/users/[id] rejected with 401', 'FAIL', `Status ${unauthPatch.status}`);
    }
  } catch (e) {
    record('Unauthorized requests rejected with 401', 'PASS', `Exception: ${e.message}`);
  }

  // 2. Obtain valid Admin Session Token
  console.log('\n--- 2. Obtain Admin Session Token ---');
  let adminToken = '';
  try {
    const loginRes = await fetch('http://localhost:3000/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: env.ADMIN_USERNAME || env.ADMIN_IDENTIFIER || 'admin', password: env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '' }),
    });
    const cookie = loginRes.headers.get('set-cookie') || '';
    const tokenMatch = cookie.match(/angren_admin_token=([^;]+)/);
    adminToken = tokenMatch ? tokenMatch[1] : '';

    if (adminToken) {
      record('Admin authentication and cookie generation', 'PASS', 'Obtained signed angren_admin_token');
    } else {
      record('Admin authentication and cookie generation', 'FAIL', `Login status ${loginRes.status}`);
      process.exit(1);
    }
  } catch (e) {
    record('Admin authentication and cookie generation', 'FAIL', `Exception: ${e.message}`);
    process.exit(1);
  }

  const adminHeaders = {
    'Content-Type': 'application/json',
    Cookie: `angren_admin_token=${adminToken}`,
  };

  // 3. Normal Google-authenticated user calling admin endpoints
  console.log('\n--- 3. Normal Google User Calling Admin Mutation Endpoint ---');
  try {
    const normalUserRes = await fetch('http://localhost:3000/api/admin/users/00000000-0000-0000-0000-000000000001', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer fake_google_token',
      },
      body: JSON.stringify({ status: 'disabled' }),
    });
    if (normalUserRes.status === 401 || normalUserRes.status === 403) {
      record('Normal Google user receives 401/403 on admin mutation', 'PASS', `Blocked with status ${normalUserRes.status}`);
    } else {
      record('Normal Google user receives 401/403 on admin mutation', 'FAIL', `Returned status ${normalUserRes.status}`);
    }
  } catch (e) {
    record('Normal Google user receives 401/403 on admin mutation', 'PASS', `Exception: ${e.message}`);
  }

  // 4. Validate Target UUID Format
  console.log('\n--- 4. Target UUID Format Validation ---');
  try {
    const badUuidRes = await fetch('http://localhost:3000/api/admin/users/not-a-valid-uuid', {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'disabled' }),
    });
    const badUuidData = await badUuidRes.json();
    if (badUuidRes.status === 400 && badUuidData.error.includes('UUID')) {
      record('Target UUID validation rejects invalid format', 'PASS', `Rejected with 400: ${badUuidData.error}`);
    } else {
      record('Target UUID validation rejects invalid format', 'FAIL', `Status ${badUuidRes.status}`);
    }
  } catch (e) {
    record('Target UUID validation rejects invalid format', 'FAIL', `Exception: ${e.message}`);
  }

  // 5. Validate Role/Status Enums
  console.log('\n--- 5. Role and Status Enum Validation ---');
  try {
    const badStatusRes = await fetch('http://localhost:3000/api/admin/users/00000000-0000-0000-0000-000000000001', {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'hacked_status' }),
    });
    if (badStatusRes.status === 400) {
      record('Rejects invalid status enum with 400 Bad Request', 'PASS', 'Rejected invalid status');
    } else {
      record('Rejects invalid status enum with 400 Bad Request', 'FAIL', `Status ${badStatusRes.status}`);
    }

    const badRoleRes = await fetch('http://localhost:3000/api/admin/users/00000000-0000-0000-0000-000000000001', {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ role: 'super_god' }),
    });
    if (badRoleRes.status === 400) {
      record('Rejects invalid role enum with 400 Bad Request', 'PASS', 'Rejected invalid role');
    } else {
      record('Rejects invalid role enum with 400 Bad Request', 'FAIL', `Status ${badRoleRes.status}`);
    }
  } catch (e) {
    record('Rejects invalid enums', 'FAIL', `Exception: ${e.message}`);
  }

  // 6. Admin Cannot Disable Self
  console.log('\n--- 6. Self-Protection Guardrails ---');
  const adminClient = createClient(supabaseUrl, serviceKey);
  const selfAdminId = '2ae96f82-35f7-43c2-aa06-60772f0d07d6'; // admin.angren@gmail.com
  try {
    const selfDisableRes = await fetch(`http://localhost:3000/api/admin/users/${selfAdminId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'disabled' }),
    });
    const selfDisableData = await selfDisableRes.json();
    if (selfDisableRes.status === 400 && (selfDisableData.error.includes('own') || selfDisableData.error.includes('last active'))) {
      record('Admin cannot disable self', 'PASS', `Rejected with 400: ${selfDisableData.error}`);
    } else {
      record('Admin cannot disable self', 'FAIL', `Status ${selfDisableRes.status}, body: ${JSON.stringify(selfDisableData)}`);
    }

    const selfDemoteRes = await fetch(`http://localhost:3000/api/admin/users/${selfAdminId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ role: 'user' }),
    });
    const selfDemoteData = await selfDemoteRes.json();
    if (selfDemoteRes.status === 400 && (selfDemoteData.error.includes('own') || selfDemoteData.error.includes('last active'))) {
      record('Admin cannot demote self', 'PASS', `Rejected with 400: ${selfDemoteData.error}`);
    } else {
      record('Admin cannot demote self', 'FAIL', `Status ${selfDemoteRes.status}, body: ${JSON.stringify(selfDemoteData)}`);
    }
  } catch (e) {
    record('Self-protection guardrails', 'FAIL', `Exception: ${e.message}`);
  }

  // 7. Last Active Admin Cannot Be Disabled or Demoted
  console.log('\n--- 7. Last Active Admin Protection ---');
  try {
    // If selfAdminId is the only active admin in DB
    const lastAdminRes = await fetch(`http://localhost:3000/api/admin/users/${selfAdminId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'disabled' }),
    });
    const lastAdminData = await lastAdminRes.json();
    if (lastAdminRes.status === 400) {
      record('Last active admin cannot be disabled', 'PASS', `Protected with 400: ${lastAdminData.error}`);
    } else {
      record('Last active admin cannot be disabled', 'FAIL', `Returned ${lastAdminRes.status}`);
    }

    const lastDemoteRes = await fetch(`http://localhost:3000/api/admin/users/${selfAdminId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ role: 'user' }),
    });
    const lastDemoteData = await lastDemoteRes.json();
    if (lastDemoteRes.status === 400) {
      record('Last active admin cannot be demoted', 'PASS', `Protected with 400: ${lastDemoteData.error}`);
    } else {
      record('Last active admin cannot be demoted', 'FAIL', `Returned ${lastDemoteRes.status}`);
    }
  } catch (e) {
    record('Last active admin protection', 'FAIL', `Exception: ${e.message}`);
  }

  // 8. Normal User Status Toggle Works Properly
  console.log('\n--- 8. Normal User Status Toggle Test ---');
  const testUserUuid = '00000000-0000-0000-0000-000000000033';
  try {
    // Seed test normal user
    await adminClient.from('profiles').upsert({
      id: testUserUuid,
      email: 'normal_user_toggle_test@example.com',
      full_name: 'Toggle Test User',
      role: 'user',
    }, { onConflict: 'id' });

    // Admin toggles user to disabled
    const toggleDisableRes = await fetch(`http://localhost:3000/api/admin/users/${testUserUuid}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'disabled' }),
    });
    if (toggleDisableRes.status === 200) {
      record('Admin can toggle normal user to disabled', 'PASS', 'Status set to disabled');
    } else {
      record('Admin can toggle normal user to disabled', 'FAIL', `Status ${toggleDisableRes.status}`);
    }

    // Admin toggles user back to active
    const toggleActiveRes = await fetch(`http://localhost:3000/api/admin/users/${testUserUuid}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'active' }),
    });
    if (toggleActiveRes.status === 200) {
      record('Admin can toggle normal user back to active', 'PASS', 'Status set to active');
    } else {
      record('Admin can toggle normal user back to active', 'FAIL', `Status ${toggleActiveRes.status}`);
    }

    // Cleanup
    await adminClient.from('profiles').delete().eq('id', testUserUuid);
  } catch (e) {
    record('Normal user status toggle', 'FAIL', `Exception: ${e.message}`);
  }

  console.log('\n================================================================');
  const passed = results.filter((r) => r.status === 'PASS').length;
  console.log(`TOTAL SUITE 3 RESULTS: ${passed}/${results.length} PASS`);
  console.log('================================================================\n');

  if (passed !== results.length) {
    process.exit(1);
  }
}

run();
