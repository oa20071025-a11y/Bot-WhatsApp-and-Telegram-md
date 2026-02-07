const { makeWASocket, useMultiFileAuthState, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');

async function startWA(userId, phone) {
  const sessionDir = path.join(__dirname, 'sessions', String(userId));
  
  // تنظيف أي جلسة قديمة لضمان كود جديد
  if (fs.existsSync(sessionDir)) {
    await fs.remove(sessionDir);
  }
  await fs.ensureDir(sessionDir);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: false,
    // تعريف المتصفح ضروري لنجاح طلب Pairing Code
    browser: ["Ubuntu", "Chrome", "20.0.04"] 
  });

  sock.ev.on('creds.update', saveCreds);

  // تنظيف الرقم من أي رموز زائدة
  const phoneNumber = phone.replace(/\D/g, ''); 

  // انتظار بسيط لضمان استقرار الاتصال قبل طلب الكود
  await delay(3000); 

  try {
    const code = await sock.requestPairingCode(phoneNumber);

    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        console.log(`✅ تم ربط الحساب بنجاح للمستخدم: ${userId}`);
        // تشغيل البوت الأساسي بعد نجاح الربط
        exec(`cd Elmasrybot-MD && node index.js`);
      }
      
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) startWA(userId, phone);
      }
    });

    return code;
  } catch (err) {
    console.error("Pairing Error:", err);
    throw err;
  }
}

module.exports = { startWA };
