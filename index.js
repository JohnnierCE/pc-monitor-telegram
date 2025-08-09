const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const TELEGRAM_TOKEN = "8308992460:AAHoSoA9rWhHJCt9FuX2RkdBCVhmdnSX6d8";
const CHAT_ID = "5703312558";

let lastPingTime = Date.now();
let noPingInterval = null; // para el temporizador cuando no hay pings
let secondsWithoutPing = 0;

app.use(express.json());

// Endpoint para recibir pings
app.post('/ping', (req, res) => {
    lastPingTime = Date.now();
    secondsWithoutPing = 0; // reiniciar contador
    if (noPingInterval) {
        clearInterval(noPingInterval);
        noPingInterval = null;
    }
    res.send("Ping recibido ✅");
});

// Función para enviar mensajes a Telegram
async function sendTelegramMessage(message) {
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: message
        });
    } catch (error) {
        console.error("Error enviando mensaje a Telegram:", error.response?.data || error.message);
    }
}

// Revisar pings cada segundo
setInterval(() => {
    let diffSeconds = Math.floor((Date.now() - lastPingTime) / 1000);

    if (diffSeconds > 15 && !noPingInterval) {
        // Primer fallo detectado → iniciar intervalos de alerta
        secondsWithoutPing = diffSeconds;
        sendTelegramMessage(`⚠ No hay pings desde hace más de ${secondsWithoutPing} segundos`);
        
        noPingInterval = setInterval(() => {
            secondsWithoutPing += 15;
            sendTelegramMessage(`⚠ No hay pings desde hace más de ${secondsWithoutPing} segundos`);
        }, 15000);
    }
}, 1000);

app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});
