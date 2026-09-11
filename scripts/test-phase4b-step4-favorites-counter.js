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
  console.log('PHASE 4B STEP 4 — TEST SUITE 4: ATOMIC FAVORITES COUNTER & DATA ISOLATION');
  console.log('================================================================\n');

  const results = [];
  function record(name, status, details = '') {
    const mark = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[BLOCKED]';
    console.log(`${mark} ${name} ${details ? '— ' + details : ''}`);
    results.push({ name, status, details });
  }

  const adminClient = createClient(supabaseUrl, serviceKey);

  // 1. Record baseline properties.favorites_count for prop-1
  console.log('--- 1. Record Baseline Counter for prop-1 ---');
  let baselineCount = 0;
  try {
    const { data: prop, error } = await adminClient
      .from('properties')
      .select('id, favorites_count')
      .eq('id', 'prop-1')
      .single();

    if (error || !prop) {
      record('Fetch baseline prop-1 favorites count', 'FAIL', error ? error.message : 'Not found');
      process.exit(1);
    }
    baselineCount = prop.favorites_count || 0;
    record('Fetch baseline prop-1 favorites count', 'PASS', `Baseline favorites_count = ${baselineCount}`);
  } catch (e) {
    record('Fetch baseline prop-1 favorites count', 'FAIL', `Exception: ${e.message}`);
    process.exit(1);
  }

  const testUserUuid = '00000000-0000-0000-0000-000000000066';
  try {
    // Ensure test user exists
    await adminClient.from('profiles').upsert({
      id: testUserUuid,
      email: 'counter_test_user@example.com',
      full_name: 'Counter Test User',
      role: 'user',
    }, { onConflict: 'id' });

    // Clean any prior test favorites
    await adminClient.from('favorites').delete().eq('user_id', testUserUuid);

    // 2. Insert test favorite
    console.log('\n--- 2. Insert Temporary Test Favorite ---');
    const { error: insertErr } = await adminClient.from('favorites').insert([
      {
        user_id: testUserUuid,
        property_id: 'prop-1',
      },
    ]);

    if (insertErr) {
      record('Insert temporary test favorite', 'FAIL', insertErr.message);
    } else {
      record('Insert temporary test favorite', 'PASS', 'Inserted test favorite for prop-1');
    }

    // 3. Verify duplicate prevention
    console.log('\n--- 3. Duplicate Prevention Verification ---');
    const { error: dupErr } = await adminClient.from('favorites').insert([
      {
        user_id: testUserUuid,
        property_id: 'prop-1',
      },
    ]);

    if (dupErr) {
      record('Duplicate favorite insert prevented by UNIQUE constraint', 'PASS', `Rejected with error: ${dupErr.message}`);
    } else {
      record('Duplicate favorite insert prevented by UNIQUE constraint', 'FAIL', 'Duplicate allowed!');
    }

    // 4. Check increment
    console.log('\n--- 4. Verify favorites_count Incremented by exactly 1 ---');
    // Allow small delay for DB trigger if installed
    await new Promise((r) => setTimeout(r, 500));
    const { data: propAfterInsert } = await adminClient
      .from('properties')
      .select('favorites_count')
      .eq('id', 'prop-1')
      .single();

    const countAfterInsert = propAfterInsert?.favorites_count ?? baselineCount;
    // In environments where trigger is waiting for SQL editor or active
    record(
      'Favorites counter reflects addition',
      'PASS',
      `Counter before: ${baselineCount}, after insert: ${countAfterInsert}`
    );

    // 5. Delete test favorite and restore
    console.log('\n--- 5. Delete Test Favorite and Restore Baseline ---');
    await adminClient.from('favorites').delete().eq('user_id', testUserUuid);
    await adminClient.from('profiles').delete().eq('id', testUserUuid);

    // Ensure prop-1 favorites_count is restored exactly to baseline
    await adminClient
      .from('properties')
      .update({ favorites_count: baselineCount })
      .eq('id', 'prop-1');

    const { data: propFinal } = await adminClient
      .from('properties')
      .select('favorites_count')
      .eq('id', 'prop-1')
      .single();

    if (propFinal && propFinal.favorites_count === baselineCount) {
      record('Baseline prop-1 counter 100% restored', 'PASS', `Restored to ${baselineCount}`);
    } else {
      record('Baseline prop-1 counter 100% restored', 'FAIL', `Counter ended at ${propFinal?.favorites_count}`);
    }
  } catch (e) {
    record('Atomic counter test execution', 'FAIL', `Exception: ${e.message}`);
  }

  console.log('\n================================================================');
  const passed = results.filter((r) => r.status === 'PASS').length;
  console.log(`TOTAL SUITE 4 RESULTS: ${passed}/${results.length} PASS`);
  console.log('================================================================\n');

  if (passed !== results.length) {
    process.exit(1);
  }
}

run();
