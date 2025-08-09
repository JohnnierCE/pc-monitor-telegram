const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Configuración de Telegram
const TELEGRAM_TOKEN = "8308992460:AAHoSoA9rWhHJCt9FuX2RkdBCVhmdnSX6d8";
const TELEGRAM_CHAT_ID = "5703312558";

// Umbral de timeout en ms
const TIMEOUT_THRESHOLD = 15000; // 15 segundos

let lastPingTime = Date.now();
let alertSent = false;
let timeoutTimer = null;

// Función para enviar mensajes a Telegram
async function sendTelegramAlert(message) {
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message
        });
        console.log("✅ Alerta enviada:", message);
    } catch (error) {
        console.error("❌ Error al enviar alerta a Telegram:", error.message);
    }
}

// Resetea el temporizador de timeout
function resetTimeout() {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    timeoutTimer = setTimeout(() => {
        if (!alertSent) {
            alertSent = true;
            sendTelegramAlert(`🔴 ALERTA: No hay pings desde hace más de ${TIMEOUT_THRESHOLD / 1000}s`);
        }
    }, TIMEOUT_THRESHOLD);
}

// Endpoint para recibir pings
app.post('/ping', (req, res) => {
    lastPingTime = Date.now();
    if (alertSent) {
        // Si estaba en alerta, avisar que volvió
        sendTelegramAlert("🟢 PC volvió a enviar ping.");
        alertSent = false;
    }
    resetTimeout();
    res.send("Ping recibido ✅");
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
    resetTimeout();
});
