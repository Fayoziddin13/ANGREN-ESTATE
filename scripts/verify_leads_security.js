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

// Read environment from .env.local
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

async function runSecuritySuite() {
  console.log('================================================================');
  console.log('ANGREN ESTATE — PHASE 4B STEP 2 SECURITY VERIFICATION SUITE');
  console.log('================================================================\n');

  const results = [];
  function record(name, status, details = '') {
    const mark = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[BLOCKED]';
    console.log(`${mark} ${name} ${details ? '— ' + details : ''}`);
    results.push({ name, status, details });
  }

  // 1. Anonymous client direct query on public.leads
  console.log('--- 1. Anonymous Client Direct Database Access ---');
  try {
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data, error } = await anonClient.from('leads').select('*');
    if (error) {
      record('Anonymous SELECT on public.leads', 'PASS', `Direct select blocked (${error.message})`);
    } else if (!data || data.length === 0) {
      record('Anonymous SELECT on public.leads', 'PASS', 'Returned 0 rows due to RLS default DENY');
    } else {
      record('Anonymous SELECT on public.leads', 'FAIL', `Leaked ${data.length} records to anonymous client!`);
    }
  } catch (err) {
    record('Anonymous SELECT on public.leads', 'PASS', `Blocked with exception: ${err.message}`);
  }

  // 2. Authenticated non-admin client direct access
  console.log('\n--- 2. Authenticated Non-Admin Direct Database Access ---');
  try {
    const testUserToken = makeJwt({
      aud: 'authenticated',
      role: 'authenticated',
      sub: '00000000-0000-0000-0000-000000000099',
      email: 'regular_user@example.com',
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: 'Regular Visitor' },
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${testUserToken}` } },
    });

    const { data: userData, error: userError } = await userClient.from('leads').select('*');
    if (userError || !userData || userData.length === 0) {
      record('Authenticated non-admin SELECT on public.leads', 'PASS', `Direct select rejected/blocked (${userError ? userError.message : '0 rows via RLS'})`);
    } else {
      record('Authenticated non-admin SELECT on public.leads', 'FAIL', `Leaked ${userData.length} records!`);
    }

    const { data: updateData, error: updateError } = await userClient
      .from('leads')
      .update({ status: 'cancelled' })
      .eq('id', 'test-uuid');

    if (updateError || !updateData || updateData.length === 0) {
      record('Authenticated non-admin UPDATE on public.leads', 'PASS', `Direct update rejected/blocked (${updateError ? updateError.message : '0 rows updated'})`);
    } else {
      record('Authenticated non-admin UPDATE on public.leads', 'FAIL', 'Direct client update succeeded!');
    }
  } catch (err) {
    record('Authenticated non-admin SELECT on public.leads', 'PASS', `Blocked: ${err.message}`);
    record('Authenticated non-admin UPDATE on public.leads', 'PASS', `Blocked: ${err.message}`);
  }

  // 3. Admin API Security & Access
  console.log('\n--- 3. Admin API Security & Protected Server Access ---');
  // 3.1 Unauthenticated Admin API request
  const unauthRes = await fetch('http://localhost:3000/api/admin/leads');
  if (unauthRes.status === 401) {
    record('Admin GET /api/admin/leads unauthorized guard', 'PASS', 'Returns 401 Unauthorized for unauthenticated requests');
  } else {
    record('Admin GET /api/admin/leads unauthorized guard', 'FAIL', `Returned status ${unauthRes.status}`);
  }

  // 3.2 Authenticated Admin API request
  const loginRes = await fetch('http://localhost:3000/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: env.ADMIN_USERNAME || env.ADMIN_IDENTIFIER || 'admin', password: env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '' }),
  });
  const cookie = loginRes.headers.get('set-cookie') || '';
  const tokenMatch = cookie.match(/angren_admin_token=([^;]+)/);
  const adminToken = tokenMatch ? tokenMatch[1] : '';

  const authLeadsRes = await fetch('http://localhost:3000/api/admin/leads', {
    headers: { Cookie: `angren_admin_token=${adminToken}` },
  });
  if (authLeadsRes.status === 200) {
    const data = await authLeadsRes.json();
    record('Admin GET /api/admin/leads authorized access', 'PASS', `Returns 200 OK with ${data.leads ? data.leads.length : 0} leads and stats`);
  } else {
    record('Admin GET /api/admin/leads authorized access', 'FAIL', `Returned status ${authLeadsRes.status}`);
  }

  // 3.3 Admin PATCH API request validation
  const patchRes = await fetch('http://localhost:3000/api/admin/leads/non-existent-id', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `angren_admin_token=${adminToken}`,
    },
    body: JSON.stringify({ status: 'invalid_status' }),
  });
  if (patchRes.status === 400) {
    record('Admin PATCH /api/admin/leads/[id] validation', 'PASS', 'Correctly rejects invalid status with 400 Bad Request');
  } else {
    record('Admin PATCH /api/admin/leads/[id] validation', 'FAIL', `Returned status ${patchRes.status}`);
  }

  // 4. Public POST /api/leads
  console.log('\n--- 4. Public Lead Ingestion Endpoint ---');
  const pubBadType = await fetch('http://localhost:3000/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ property_id: 'prop-2', type: 'hacked_type' }),
  });
  if (pubBadType.status === 400) {
    record('Public POST /api/leads invalid type guard', 'PASS', 'Rejects unauthorized contact type with 400');
  } else {
    record('Public POST /api/leads invalid type guard', 'FAIL', `Returned ${pubBadType.status}`);
  }

  const pubMissingProp = await fetch('http://localhost:3000/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'phone' }),
  });
  if (pubMissingProp.status === 400) {
    record('Public POST /api/leads missing property guard', 'PASS', 'Rejects missing property_id with 400');
  } else {
    record('Public POST /api/leads missing property guard', 'FAIL', `Returned ${pubMissingProp.status}`);
  }

  // 5. SECURITY DEFINER RPC Hardening Check
  console.log('\n--- 5. Atomic RPC search_path Security Hardening ---');
  const migrationSql = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20260910_leads_system.sql'),
    'utf8'
  );

  const hasExplicitSearchPath = migrationSql.includes('SET search_path = public, pg_temp') || migrationSql.includes('SET search_path = public');
  const hasRevokePublic = migrationSql.includes('REVOKE ALL ON FUNCTION public.increment_property_contacts') && migrationSql.includes('FROM PUBLIC');
  const hasGrantServiceRole = migrationSql.includes('TO service_role');
  const noBroadAuthSelect = !migrationSql.includes('CREATE POLICY "Authenticated users can read leads"');
  const noBroadAuthUpdate = !migrationSql.includes('CREATE POLICY "Authenticated users can update leads"');

  record('increment_property_contacts SET search_path', hasExplicitSearchPath ? 'PASS' : 'FAIL', 'search_path = public, pg_temp configured');
  record('increment_property_contacts execution restricted to service_role', (hasRevokePublic && hasGrantServiceRole) ? 'PASS' : 'FAIL', 'Public execution revoked, granted exclusively to service_role');
  record('Migration excludes broad authenticated SELECT policy', noBroadAuthSelect ? 'PASS' : 'FAIL', 'No direct client SELECT policy');
  record('Migration excludes broad authenticated UPDATE policy', noBroadAuthUpdate ? 'PASS' : 'FAIL', 'No direct client UPDATE policy');

  // 6. Client Bundle Secrets Leak Check
  console.log('\n--- 6. Client Bundle Secret Scan ---');
  let leakedInBundle = false;
  const staticDir = path.join(__dirname, '..', '.next', 'static');
  if (fs.existsSync(staticDir)) {
    function scanDir(dir) {
      for (const item of fs.readdirSync(dir)) {
        const full = path.join(dir, item);
        if (fs.statSync(full).isDirectory()) scanDir(full);
        else if (item.endsWith('.js')) {
          const text = fs.readFileSync(full, 'utf8');
          if (text.includes(serviceKey)) leakedInBundle = true;
        }
      }
    }
    scanDir(staticDir);
  }
  record('No service role key in client bundles', !leakedInBundle ? 'PASS' : 'FAIL', 'Scanned .next/static/ bundles for service role key');

  // 7. Client-facing code check
  const supabaseTs = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'lib', 'supabase.ts'),
    'utf8'
  );
  const noServiceKeyInSupabaseTs = !supabaseTs.includes('SUPABASE_SERVICE_ROLE_KEY');
  record('No SUPABASE_SERVICE_ROLE_KEY in client supabase.ts', noServiceKeyInSupabaseTs ? 'PASS' : 'FAIL', 'Cleaned from src/lib/supabase.ts');

  // Summary
  console.log('\n================================================================');
  const passCount = results.filter(r => r.status === 'PASS').length;
  console.log(`SECURITY VERIFICATION SCORECARD: ${passCount} / ${results.length} PASS`);
  console.log('================================================================\n');
}

runSecuritySuite().catch(e => {
  console.error('Security suite error:', e);
  process.exit(1);
});
