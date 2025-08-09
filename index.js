const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8308992460:AAHoSoA9rWhHJCt9FuX2RkdBCVhmdnSX6d8';
const CHAT_ID = process.env.CHAT_ID || '5703312558';
const TELEGRAM_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

const CHECK_INTERVAL = 10000; // 10 segundos
const TIMEOUT_THRESHOLD = 15000; // 15 segundos
const LOG_FILE = 'ping-log.json';
const LASTPING_FILE = 'lastPing.json';

let lastPingTime = null;
let isOnline = false;
let alertSent = false;
let monitoringInterval = null;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function sendTelegramAlert(message) {
    try {
        await axios.post(TELEGRAM_URL, { chat_id: CHAT_ID, text: message }, { timeout: 10000 });
        console.log(`📱 TELEGRAM ENVIADO: ${message}`);
        return true;
    } catch (error) {
        console.error('❌ Error enviando Telegram:', error.message);
        return false;
    }
}

async function readLogs() {
    try {
        return JSON.parse(await fs.readFile(LOG_FILE, 'utf8'));
    } catch {
        return [];
    }
}

async function writeLogs(logs) {
    try {
        await fs.writeFile(LOG_FILE, JSON.stringify(logs, null, 2));
    } catch (error) {
        console.error('❌ Error escribiendo logs:', error);
    }
}

async function saveLastPing() {
    try {
        await fs.writeFile(LASTPING_FILE, JSON.stringify({ lastPingTime }));
    } catch (error) {
        console.error('❌ Error guardando último ping:', error);
    }
}

async function loadLastPing() {
    try {
        const data = JSON.parse(await fs.readFile(LASTPING_FILE, 'utf8'));
        lastPingTime = data.lastPingTime || null;
    } catch {
        lastPingTime = null;
    }
}

async function addPingLog(pcName, status, event = 'PING') {
    const logs = await readLogs();
    const now = new Date();
    const newLog = {
        id: logs.length + 1,
        pcName,
        status,
        event,
        timestamp: now.toISOString(),
        localTime: now.toLocaleString('es-ES', {
            timeZone: 'America/Mexico_City',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })
    };

    logs.push(newLog);
    if (logs.length > 100) logs.splice(0, logs.length - 100);
    await writeLogs(logs);
    return newLog;
}

async function checkHeartbeat() {
    const now = Date.now();

    if (lastPingTime === null) {
        console.log('⏳ Esperando primer ping...');
        return;
    }

    const timeSinceLastPing = now - lastPingTime;
    const secondsAgo = Math.floor(timeSinceLastPing / 1000);

    if (timeSinceLastPing > TIMEOUT_THRESHOLD) {
        // ALERTA OFFLINE siempre que haya tenido al menos un ping previo
        if (isOnline || (!isOnline && lastPingTime !== null && !alertSent)) {
            isOnline = false;
            const message = `🔴 ALERTA: PC DESCONECTADA\n⏰ Último ping hace ${secondsAgo} segundos\n📅 ${new Date().toLocaleString('es-ES')}`;
            console.log('\n' + '🚨'.repeat(20));
            console.log('🚨 PC DESCONECTADA');
            console.log(`⏰ Último ping: hace ${secondsAgo} segundos`);
            console.log('🚨'.repeat(20) + '\n');
            await sendTelegramAlert(message);
            await addPingLog('PC-REMOTA', 'OFFLINE', 'DISCONNECT');
            alertSent = true;
        }
    } else {
        // RECONECTADO
        if (!isOnline || alertSent) {
            isOnline = true;
            alertSent = false;
            const message = `🟢 PC RECONECTADA\n✅ Conexión restaurada\n📅 ${new Date().toLocaleString('es-ES')}`;
            console.log('\n' + '✅'.repeat(20));
            console.log('✅ PC RECONECTADA');
            console.log('✅'.repeat(20) + '\n');
            await sendTelegramAlert(message);
            await addPingLog('PC-REMOTA', 'ONLINE', 'RECONNECT');
        }
    }
}

app.get('/ping', async (req, res) => {
    try {
        const pcName = req.query.pc || 'PC-REMOTA';
        const status = req.query.status || 'OK';

        lastPingTime = Date.now();
        await saveLastPing();

        const pingLog = await addPingLog(pcName, status, 'PING');
        console.log(`🔔 PING #${pingLog.id} - ${pcName} - ${status} - ${pingLog.localTime}`);

        if (!isOnline) {
            isOnline = true;
            alertSent = false;
            const message = `🟢 PC CONECTADA\n🖥️ ${pcName} iniciado\n📅 ${pingLog.localTime}`;
            await sendTelegramAlert(message);
            await addPingLog(pcName, 'ONLINE', 'STARTUP');
        }

        res.status(200).send('Ping recibido correctamente');
    } catch (error) {
        console.error('❌ Error procesando ping:', error);
        res.status(500).send('Error interno del servidor');
    }
});

app.get('/status', async (req, res) => {
    const now = Date.now();
    const timeSinceLastPing = lastPingTime ? now - lastPingTime : null;
    res.json({
        success: true,
        isOnline,
        lastPingTime: lastPingTime ? new Date(lastPingTime).toISOString() : null,
        secondsSinceLastPing: timeSinceLastPing ? Math.floor(timeSinceLastPing / 1000) : null,
        serverTime: new Date().toISOString(),
        alertSent
    });
});

app.get('/test-telegram', async (req, res) => {
    const message = `🧪 TEST DEL SERVIDOR\n📡 Monitor funcionando correctamente\n📅 ${new Date().toLocaleString('es-ES')}`;
    const sent = await sendTelegramAlert(message);
    res.json({ success: sent, message: sent ? 'Test enviado' : 'Error enviando test' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', uptime: process.uptime(), timestamp: new Date().toISOString(), isMonitoring: monitoringInterval !== null });
});

app.listen(PORT, async () => {
    console.log('\n' + '🚀'.repeat(30));
    console.log('🚀 MONITOR DE PC CON TELEGRAM INICIADO EN RAILWAY');
    console.log('🚀'.repeat(30));
    console.log(`📡 Puerto: ${PORT}`);
    console.log(`🌐 Endpoint ping: /ping`);
    console.log(`📊 Status: /status`);
    console.log(`🧪 Test Telegram: /test-telegram`);
    console.log(`❤️  Health: /health`);
    console.log(`⏰ Verificación cada: ${CHECK_INTERVAL/1000}s`);
    console.log(`⚠️  Timeout: ${TIMEOUT_THRESHOLD/1000}s`);
    console.log(`📱 Chat ID: ${CHAT_ID}`);
    console.log('🚀'.repeat(30) + '\n');

    await loadLastPing();

    try {
        await readLogs();
        console.log('✅ Sistema de logs inicializado');
    } catch {
        await writeLogs([]);
        console.log('📝 Archivo de logs creado');
    }

    await sendTelegramAlert(`🚀 SERVIDOR FUCKING INICIADO\n📡 Esperando pings de PC\n📅 ${new Date().toLocaleString('es-ES')}`);

    monitoringInterval = setInterval(checkHeartbeat, CHECK_INTERVAL);
    console.log('🔍 Monitoreo iniciado...\n');
});

process.on('SIGINT', async () => {
    console.log('\n🛑 Cerrando servidor...');
    if (monitoringInterval) clearInterval(monitoringInterval);
    await sendTelegramAlert(`🛑 SERVIDOR RAILWAY DETENIDO\n📡 Monitor desconectado\n📅 ${new Date().toLocaleString('es-ES')}`);
    console.log('👋 ¡Servidor cerrado!');
    process.exit(0);
});

process.on('uncaughtException', async (error) => {
    console.error('💥 Error crítico:', error);
    await sendTelegramAlert(`💥 ERROR EN SERVIDOR RAILWAY\n🔧 ${error.message}\n📅 ${new Date().toLocaleString('es-ES')}`);
});
