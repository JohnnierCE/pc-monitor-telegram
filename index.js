const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const TELEGRAM_TOKEN = "8308992460:AAHoSoA9rWhHJCt9FuX2RkdBCVhmdnSX6d8";
const CHAT_ID = "5703312558";

const ALERT_INTERVAL_MS = 50000;   // Verifica estado cada 50 seg
const ALERT_REPEAT_MS = 60000;     // Repite alerta cada 1 min si sigue caída
const PING_TIMEOUT_S = 60;         // Considera caída si no hay ping en 60 seg
const LOG_CLEAR_INTERVAL_MS = 30 * 60 * 1000; // Limpiar consola cada 30 min

const EXPECTED_IDS = ["SV_DIGITAL", "EC_DIGITAL", "NI_DIGITAL","RD_UTIL","CR_DIGITAL"];

const lastPingTimes = {};
const alertaActiva = {};
const lastAlertSentTime = {};

// Inicialización
for (const id of EXPECTED_IDS) {
    lastPingTimes[id] = Date.now();
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

// Función para saber si está en el horario de monitoreo (11:00 a 23:00)
function enHorarioActivo() {
    const ahora = new Date().toLocaleString("en-US", { timeZone: "America/Bogota" });
    const hora = new Date(ahora).getHours();
    return hora >= 11 && hora < 23;
}

// Verificación periódica de pings (solo si está en horario)
setInterval(() => {
    if (!enHorarioActivo()) return;

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

// Limpieza de log cada 30 minutos
setInterval(() => {
    console.clear();
    console.log(`[LOG] Consola limpiada automáticamente a las ${new Date().toLocaleTimeString()}`);
}, LOG_CLEAR_INTERVAL_MS);

// Endpoint de ping
app.get("/ping", (req, res) => {
    if (!enHorarioActivo()) {
        return res.status(403).send("Monitoreo activo solo entre 11:00 y 23:00 hora Colombia.");
    }

    const id = req.query.id;
    if (!id || !EXPECTED_IDS.includes(id)) {
        return res.status(400).send("ID inválido o no permitido");
    }

    lastPingTimes[id] = Date.now();
    console.log(`[Ping] Recibido ping de ${id} a las ${new Date().toLocaleTimeString("es-CO", { timeZone: "America/Bogota" })}`);

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
