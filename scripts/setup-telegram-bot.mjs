import fs from 'fs';
import path from 'path';

// Load .env.local if exists
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://angrenestate.uz';

console.log('--- ANGREN ESTATE Telegram Bot Setup ---');
console.log('Site URL:', siteUrl);

if (!botToken) {
  console.error('ERROR: TELEGRAM_BOT_TOKEN is not set in environment or .env.local.');
  console.log('Add TELEGRAM_BOT_TOKEN=your_token to .env.local and run this script again.');
  process.exit(1);
}

async function runSetup() {
  try {
    // 1. Get bot info
    const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const meData = await meRes.json();
    if (!meData.ok) {
      throw new Error(`Failed to verify bot token: ${meData.description}`);
    }
    console.log(`Verified Bot: @${meData.result.username} (${meData.result.first_name})`);

    // 2. Set Menu Button
    console.log('Configuring Menu Button to open Mini App...');
    const menuRes = await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menu_button: {
          type: 'web_app',
          text: 'ANGREN ESTATE',
          web_app: {
            url: siteUrl,
          },
        },
      }),
    });
    const menuData = await menuRes.json();
    console.log('setChatMenuButton result:', menuData.ok ? 'SUCCESS' : menuData.description);

    // 3. Set Bot Commands
    console.log('Registering bot commands...');
    const cmdRes = await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'start', description: 'Boshlash / Запустить бота' },
          { command: 'app', description: 'ANGREN ESTATE Mini App' },
        ],
      }),
    });
    const cmdData = await cmdRes.json();
    console.log('setMyCommands result:', cmdData.ok ? 'SUCCESS' : cmdData.description);

    console.log('\nTelegram Bot setup completed successfully!');
  } catch (err) {
    console.error('Setup failed:', err.message);
    process.exit(1);
  }
}

runSetup();
