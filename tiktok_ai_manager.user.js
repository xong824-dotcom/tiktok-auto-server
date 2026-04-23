// ==UserScript==
// @name         TikTok Live AI Manager (cha_aming)
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  TikTok 라이브(@cha_aming) 전용 AI 매니저 매크로 (자동 인사/감사 기능 추가)
// @author       Antigravity
// @match        https://www.tiktok.com/@cha_aming/live*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    /* ================================================================
       0. 상수 및 설정
    ================================================================ */
    const GEMINI_API_KEY = "AIzaSyDfPiDelUaYJonz56lUKoXPJtDqqjELDFI";
    const FB_URL    = "https://myflexhelper-121f0-default-rtdb.firebaseio.com";
    const CH        = "tiktok_cha_aming";
    
    const DEFAULT_PERSONALITY = "귀엽고 친절한 밍라클 매니저";

    /* ================================================================
       1. 유틸 및 상태
    ================================================================ */
    const getKSTDate = (offsetDays = 0) => {
        const d = new Date();
        const kstMs = d.getTime() + (9 * 60 * 60 * 1000);
        const kstDate = new Date(kstMs);
        kstDate.setUTCDate(kstDate.getUTCDate() + offsetDays);
        return kstDate.toISOString().slice(0, 10);
    };
    const getToday     = () => getKSTDate(0);
    const sleep        = (ms) => new Promise(r => setTimeout(r, ms));
    
    let isDBLoaded           = false;
    let currentDay           = getToday();
    let todayChecked         = new Set();
    let lastAiTime           = 0;
    let lastProcessedMsgId   = "";
    
    let DB = {
        settings: { aiPersonality: DEFAULT_PERSONALITY, minGift: 1 },
        attendance: {},
        dailyRank: {},
        fortunes: {},
        aiMemory: {},
        dailyDiary: {},
    };

    /* ================================================================
       2. 채팅 전송 (TikTok DOM 조작)
    ================================================================ */
    async function reply(msg) {
        if (!msg) return;
        try {
            const input = document.querySelector('div[contenteditable="true"][data-e2e="chat-input"]');
            const sendBtn = document.querySelector('[data-e2e="chat-send-button"]');
            
            if (!input || !sendBtn) return;

            input.focus();
            input.textContent = msg;
            input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: msg }));
            await sleep(200);
            
            if (sendBtn.disabled || sendBtn.getAttribute('disabled') !== null) {
                input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            } else {
                sendBtn.click();
            }
            console.log(`[Bot] ${msg}`);
        } catch(e) { console.error('[reply error]', e); }
    }

    /* ================================================================
       3. Firebase 연동
    ================================================================ */
    async function syncDB() {
        try {
            const res = await fetch(`${FB_URL}/channels/${CH}.json`);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const cloud = await res.json();
            if (cloud) {
                DB = Object.assign(DB, cloud);
                // 출석 데이터 복원
                const today = getToday();
                Object.entries(DB.attendance || {}).forEach(([id, d]) => {
                    if (d && d.lastDate === today) todayChecked.add(id);
                });
            }
            isDBLoaded = true;
            console.log(`[Sync] 동기화 완료 / 오늘 출석: ${todayChecked.size}명`);
            setTimeout(() => reply("🤖 TikTok AI 매니저 자동모드 가동! (인사/선물감사 활성화) 💖"), 2000);
        } catch(e) { setTimeout(syncDB, 10000); }
    }

    async function saveDB() {
        if (!isDBLoaded) return;
        try {
            await fetch(`${FB_URL}/channels/${CH}.json`, {
                method: 'PATCH', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(DB)
            });
        } catch(e) { console.warn('[saveDB] 실패'); }
    }

    /* ================================================================
       4. 자동 응답 로직
    ================================================================ */
    const handleSystemMessage = (text) => {
        if (text.includes("참여함")) {
            const nick = text.replace("참여함", "").trim();
            if (nick && !nick.includes(" ")) {
                console.log(`[입장] ${nick}`);
                // reply(`${nick}님 어서오세요! 반가워요~ 밍하! 👋💖`); // 필요시 활성화
            }
        } else if (text.includes("님의 선물") && text.includes("도착!")) {
            const parts = text.split("님의 선물");
            const nick = parts[0].trim();
            const giftInfo = parts[1].replace("도착!", "").trim();
            reply(`🎁💎 대박!! ${nick}님 ${giftInfo} 선물 너무너무 감사합니다!! 사랑해요~ 잉크! ❤️✨`);
        } else if (text.includes("좋아요") && text.includes("눌렀습니다")) {
            const nick = text.split("님이")[0].trim();
            // reply(`${nick}님 좋아요 감사합니다! 힘이 불끈불끈!! 💪💖`); // 필요시 활성화
        } else if (text.includes("팔로우했습니다")) {
            const nick = text.replace("호스트를 팔로우했습니다.", "").trim();
            reply(`✨ 환영합니다! ${nick}님 팔로우 감사드려요! 우리 오래가요~ 밍라클! 🌸💖`);
        }
    };

    const processAttendance = (mid, nick) => {
        const today = getToday();
        if (todayChecked.has(mid)) return;
        todayChecked.add(mid);
        
        DB.attendance[mid] = DB.attendance[mid] || { nick, total: 0, lastDate: "" };
        const rec = DB.attendance[mid];
        rec.total++;
        rec.lastDate = today;
        rec.nick = nick;
        
        reply(`✅ [${nick}]님 출석 완료! (총 ${rec.total}회차) 오늘도 밍나잇~ 🌙💖`);
        saveDB();
    };

    /* ================================================================
       5. 채팅 감지 (MutationObserver)
    ================================================================ */
    const observeChat = () => {
        const container = document.querySelector('[data-e2e="chat-room-messages-container"]') || document.querySelector('.css-16vvya4');
        if (!container) { setTimeout(observeChat, 2000); return; }

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType !== 1) return;
                    
                    const text = node.innerText || "";
                    
                    // 1. 일반 채팅 메시지인지 확인
                    const nameEl = node.querySelector('[data-e2e="message-owner-name"]');
                    const textEl = node.querySelector('.w-full.break-words.align-middle');
                    
                    if (nameEl && textEl) {
                        const nick = nameEl.innerText.trim();
                        const msg = textEl.innerText.trim();
                        const mid = nameEl.getAttribute('title') || nick;
                        
                        // 출석 체크 (첫 채팅 시)
                        processAttendance(mid, nick);
                        
                        // 명령어 처리
                        if (msg.startsWith('!')) {
                            // handleCmd(msg, mid, nick, false); // 이전 버전의 handleCmd 이식
                        }
                    } else {
                        // 2. 시스템 메시지 처리 (입장, 선물, 팔로우 등)
                        handleSystemMessage(text);
                    }
                });
            });
        });

        observer.observe(container, { childList: true, subtree: true });
    };

    syncDB();
    observeChat();

})();

