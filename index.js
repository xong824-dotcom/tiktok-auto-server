const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const TIKTOK_URL = 'https://www.tiktok.com/@cha_aming/live';

let browser;
let page;

async function launchBot() {
    console.log('🚀 TikTok Bot 시작 중...');
    
    browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled'
        ]
    });

    page = await browser.newPage();
    
    // User-Agent 설정 (봇 감지 회피)
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

    // 쿠키 주입 (환경변수 TIKTOK_COOKIES 사용)
    if (process.env.TIKTOK_COOKIES) {
        try {
            const cookies = JSON.parse(process.env.TIKTOK_COOKIES);
            await page.setCookie(...cookies);
            console.log('✅ 쿠키 주입 완료');
        } catch (e) {
            console.error('❌ 쿠키 주입 실패:', e.message);
        }
    } else {
        console.warn('⚠️ TIKTOK_COOKIES 환경변수가 없습니다. 로그인 없이 시작합니다.');
    }

    await page.goto(TIKTOK_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('✅ 페이지 로드 완료');

    // 팝업 닫기 시도
    try {
        await page.evaluate(() => {
            const closeBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('닫기') || b.innerText.includes('Close'));
            closeBtns.forEach(b => b.click());
        });
    } catch (e) {}

    // 유저스크립트 로드 및 주입
    const scriptPath = path.join(__dirname, 'tiktok_ai_manager.user.js');
    if (fs.existsSync(scriptPath)) {
        let script = fs.readFileSync(scriptPath, 'utf8');
        // 환경변수 반영 (API KEY 등)
        if (process.env.GEMINI_API_KEY) {
            script = script.replace(/const GEMINI_API_KEY\s*=\s*["'][^"']*["']/, `const GEMINI_API_KEY = "${process.env.GEMINI_API_KEY}"`);
        }
        
        await page.evaluate(script);
        console.log('✅ AI 매니저 스크립트 주입 완료');
    }

    // 페이지 오류 시 재시작 로직
    page.on('error', err => {
        console.error('❌ 페이지 오류:', err);
        process.exit(1);
    });
}

// 헬스체크 엔드포인트
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, async () => {
    console.log(`📡 서버 대기 중 (Port: ${PORT})`);
    try {
        await launchBot();
    } catch (e) {
        console.error('❌ 봇 실행 실패:', e);
    }
});
