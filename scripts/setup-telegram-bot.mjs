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
const siteUrl = 'https://angrenestate.uz';

console.log('--- ANGREN ESTATE Telegram Bot Setup ---');
console.log('Site URL:', siteUrl);

async function main() {
  if (!botToken) {
    console.log('TELEGRAM_BOT_TOKEN not found in local .env.local.');
    console.log('Triggering production Telegram setup on https://angrenestate.uz/api/telegram/setup ...');
    try {
      const prodRes = await fetch('https://angrenestate.uz/api/telegram/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const prodData = await prodRes.json();
      if (prodData.success) {
        console.log('Production Telegram setup succeeded:');
        console.log('- Webhook:', prodData.webhookUrl, '->', prodData.webhook?.ok ? 'OK' : prodData.webhook?.description);
        console.log('- Menu Button:', prodData.menuButton?.ok ? 'OK' : prodData.menuButton?.description);
        console.log('- Commands:', prodData.commands?.ok ? 'OK' : prodData.commands?.description);
        return;
      } else {
        console.error('Production setup error:', prodData.error);
        process.exitCode = 1;
        return;
      }
    } catch (err) {
      console.error('Network error during production setup:', err.message);
      process.exitCode = 1;
      return;
    }
  }

  try {
    // 1. Get bot info
    const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const meData = await meRes.json();
    if (!meData.ok) {
      throw new Error(`Failed to verify bot token: ${meData.description}`);
    }
    console.log(`Verified Bot: @${meData.result.username} (${meData.result.first_name})`);

    // 2. Set Webhook
    console.log('Configuring Webhook...');
    const hookRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${siteUrl}/api/telegram/webhook`,
        allowed_updates: ['message', 'callback_query'],
      }),
    });
    const hookData = await hookRes.json();
    console.log('setWebhook result:', hookData.ok ? 'SUCCESS' : hookData.description);

    // 3. Set Menu Button
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

    // 4. Set Bot Commands
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
    process.exitCode = 1;
  }
}

main();
