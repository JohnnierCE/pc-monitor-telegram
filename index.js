const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const TELEGRAM_TOKEN = "8308992460:AAHoSoA9rWhHJCt9FuX2RkdBCVhmdnSX6d8";
const CHAT_ID = "5703312558";

let lastPingTime = Date.now();
let noPingSeconds = 0;
let alertaActiva = false; // Estado para saber si estamos en alerta

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

// Monitoreo cada 15 segundos
setInterval(() => {
    const now = Date.now();
    const diffSeconds = Math.floor((now - lastPingTime) / 1000);

    if (diffSeconds > 15) {
        noPingSeconds = diffSeconds;
        const timeStr = formatTime(noPingSeconds);

        // Enviar siempre la alerta cada 15 segundos si no hay ping
        sendTelegramMessage(`⚠️ No hay pings desde hace más de ${timeStr}`);

        console.log(`⚠️ No hay pings desde hace más de ${timeStr}`);
    }
}, 15000);

// Cuando recibe un ping
app.get("/ping", (req, res) => {
    lastPingTime = Date.now();
    noPingSeconds = 0;

    console.log(`[Ping] Recibido a las ${new Date().toLocaleTimeString()}`);

    // Si estaba en alerta, avisar que ya volvió
    if (alertaActiva) {
        sendTelegramMessage(`✅ Ping restablecido a las ${new Date().toLocaleTimeString()}`);
        alertaActiva = false; // Salir de alerta
    }

    res.send("Ping recibido");
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});
