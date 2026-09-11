const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
let pg;
try {
  pg = require('pg');
} catch (e) {
  pg = null;
}

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const dbUrl = env.DATABASE_URL || env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  console.log('====================================================');
  console.log('ANGREN ESTATE — SUPABASE MIGRATION & DATA INGESTION');
  console.log('====================================================');
  console.log('Supabase URL:', supabaseUrl);
  console.log('Anon Key configured:', Boolean(supabaseAnon));
  
  const hasDbPassword = dbUrl && !dbUrl.includes('[YOUR-PASSWORD]');
  console.log('Direct Database Password Available:', hasDbPassword ? 'YES' : 'NO (Contains [YOUR-PASSWORD])');

  if (hasDbPassword && pg) {
    console.log('\n--- Step 1: Connecting to PostgreSQL via pooler/direct connection ---');
    let connStr = dbUrl;
    if (connStr.includes('db.gemozzkmoogjxtdwvepz.supabase.co')) {
      connStr = connStr.replace('db.gemozzkmoogjxtdwvepz.supabase.co:5432', 'aws-0-ap-northeast-1.pooler.supabase.com:6543');
      connStr = connStr.replace('postgresql://postgres:', 'postgresql://postgres.gemozzkmoogjxtdwvepz:');
    }
    
    const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      console.log('✓ Successfully connected to PostgreSQL database!');

      const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260910_canonical_supabase_schema.sql');
      const sql = fs.readFileSync(migrationPath, 'utf8');
      console.log('Executing migration schema SQL...');
      await client.query(sql);
      console.log('✓ Migration applied successfully!');

      const res = await client.query('SELECT count(*) FROM public.properties;');
      console.log('✓ Properties count in Supabase: ' + res.rows[0].count);
      await client.end();
      return;
    } catch (err) {
      console.error('PostgreSQL execution error:', err.message);
      await client.end().catch(() => {});
    }
  }

  console.log('\n--- Step 2: Checking Supabase REST Schema Cache ---');
  const client = createClient(supabaseUrl, supabaseAnon);
  try {
    const { data, error, count } = await client
      .from('properties')
      .select('id, title_uz, status, price_uzs', { count: 'exact' });

    if (error) {
      console.log('Supabase properties table check:', error.message);
      if (error.message.includes('Could not find the table') || error.code === 'PGRST205') {
        console.log('\n[ACTION REQUIRED]: Tables do not exist in remote Supabase database yet.');
        console.log('To apply the migration, either:');
        console.log('1) Run the SQL in your Supabase Dashboard SQL Editor at:');
        console.log('   https://supabase.com/dashboard/project/gemozzkmoogjxtdwvepz/sql');
        console.log('   (Copy from supabase/migrations/20260910_canonical_supabase_schema.sql)');
        console.log('2) OR update DATABASE_URL in .env.local with your real database password:');
        console.log('   DATABASE_URL=postgresql://postgres.gemozzkmoogjxtdwvepz:<PASSWORD>@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres');
      }
    } else {
      console.log('✓ Tables exist in Supabase! Properties count: ' + (count ?? data?.length ?? 0));
    }
  } catch (err) {
    console.error('REST client check error:', err.message);
  }
}

run();
