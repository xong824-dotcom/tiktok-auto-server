const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// // Support multiple channels via TARGET_CHANNELS environment variable (comma-separated)
const TARGET_CHANNELS = process.env.TARGET_CHANNELS 
  ? process.env.TARGET_CHANNELS.split(',').map(ch => ch.trim()) 
      : ['cha_aming'];

console.log(`Monitoring channels: ${TARGET_CHANNELS.join(', ')}`);

async function launchBot(channelName) {
      const TIKTOK_URL = `https://www.tiktok.com/@${channelName}/live`;
      console.log(`[${channelName}] Starting TikTok Bot...`);

  const browser = await puppeteer.launch({
          headless: "new",
          args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-blink-features=AutomationControlled'
                  ]
  });

  const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

  if (process.env.TIKTOK_COOKIES) {
          try {
                    const cookies = JSON.parse(process.env.TIKTOK_COOKIES);
                    await page.setCookie(...cookies);
                    console.log(`[${channelName}] Cookies injected`);
          } catch (err) {
                    console.error(`[${channelName}] Cookie injection failed:`, err.message);
          }
  }

  try {
          console.log(`[${channelName}] Navigating to: ${TIKTOK_URL}`);
          await page.goto(TIKTOK_URL, { waitUntil: 'networkidle2', timeout: 60000 });
          console.log(`[${channelName}] Connection successful!`);

        page.on('console', msg => console.log(`[${channelName} Browser]`, msg.text()));

        const scriptPath = path.join(__dirname, 'tiktok_ai_manager.user.js');
          if (fs.existsSync(scriptPath)) {
                    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
                    await page.addScriptTag({ content: scriptContent });
                    console.log(`[${channelName}] AI Manager script injected`);
          }

  } catch (err) {
          console.error(`[${channelName}] Error:`, err.message);
          await browser.close();
          setTimeout(() => launchBot(channelName), 30000);
  }
}

TARGET_CHANNELS.forEach(channel => {
      launchBot(channel).catch(err => console.error(`[${channel}] Init failed:`, err));
});

app.get('/', (req, res) => {
      res.send(`TikTok AI Bot is running for: ${TARGET_CHANNELS.join(', ')}`);
});

app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
});
