const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const TELEGRAM_TOKEN = "8308992460:AAHoSoA9rWhHJCt9FuX2RkdBCVhmdnSX6d8";
const CHAT_ID = "5703312558";

const ALERT_INTERVAL_MS = 15000;   // Cada 15 segundos revisa estado
const ALERT_REPEAT_MS = 15000;    // Repite alerta cada 5 minutos si sigue caída
const PING_TIMEOUT_S = 15;         // Considera caída si no hay ping en 15 segundos

const EXPECTED_IDS = ["PC1", "PC2", "PC3"];

const lastPingTimes = {};
const alertaActiva = {};
const lastAlertSentTime = {};

// Inicializamos los estados con fecha actual para evitar tiempos gigantes
for (const id of EXPECTED_IDS) {
    lastPingTimes[id] = Date.now();  // <-- Aquí el cambio
    alertaActiva[id] = false;
    lastAlertSentTime[id] = 0;
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    let str = "";
    if (h > 0) str += `${h} h `;
    if (m > 0) str += `${m} m `;
    str += `${s} s`;
    return str.trim();
}

async function sendTelegramMessage(message) {
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: message
        });
        console.log(`[Telegram] Mensaje enviado: ${message}`);
    } catch (error) {
        console.error("[Telegram] Error al enviar mensaje:", error.message);
    }
}

setInterval(() => {
    const now = Date.now();

    for (const id of EXPECTED_IDS) {
        const diffSeconds = Math.floor((now - lastPingTimes[id]) / 1000);

        if (diffSeconds > PING_TIMEOUT_S) {
            const timeStr = formatTime(diffSeconds);

            if (!alertaActiva[id] || (now - lastAlertSentTime[id]) > ALERT_REPEAT_MS) {
                sendTelegramMessage(`⚠️ ${id} no ha enviado ping desde hace más de ${timeStr}`);
                alertaActiva[id] = true;
                lastAlertSentTime[id] = now;
            }

            console.log(`⚠️ ${id} no ha enviado ping desde hace más de ${timeStr}`);
        }
    }
}, ALERT_INTERVAL_MS);

app.get("/ping", (req, res) => {
    const id = req.query.id;

    if (!id || !EXPECTED_IDS.includes(id)) {
        return res.status(400).send("ID inválido o no permitido");
    }

    lastPingTimes[id] = Date.now();

    console.log(`[Ping] Recibido ping de ${id} a las ${new Date().toLocaleTimeString()}`);

    if (alertaActiva[id]) {
        sendTelegramMessage(`✅ Ping ${id} a las ${new Date().toLocaleTimeString("es-CO", { timeZone: "America/Bogota" })}`);
        alertaActiva[id] = false;
        lastAlertSentTime[id] = 0;
    }

    res.send(`Ping recibido para ${id}`);
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});
