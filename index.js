const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeInMemoryStore, jidDecode, proto } = require("@whiskeysockets/baileys")
const pino = require("pino")
const { Boom } = require("@hapi/boom")
const readline = require("readline")
const fs = require("fs")

// --- KONFIGURASI ---
const phoneNumber = "628xxx" // 👈 GANTI PAKE NOMOR WA LU (Awali 62, jangan pake + atau spasi)

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (text) => new Promise((resolve) => rl.question(text, resolve))

async function startVSTBOT() {
    const { state, saveCreds } = await useMultiFileAuthState("./vst_session")
    
    const client = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: false, // 👈 QR dimatiin
        auth: state,
        browser: ["Chrome (Linux)", "VSTBOT", "1.0.0"]
    })

    // --- LOGIC PAIRING CODE ---
    if (!client.authState.creds.registered) {
        setTimeout(async () => {
            let code = await client.requestPairingCode(phoneNumber)
            code = code?.match(/.{1,4}/g)?.join("-") || code
            console.log("┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓")
            console.log("┃       KODE PAIRING VSTBOT LU:          ┃")
            console.log(`┃           ${code}             ┃`)
            console.log("┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛")
        }, 3000)
    }

    client.ev.on("creds.update", saveCreds)

    client.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update
        if (connection === "close") {
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode
            if (reason !== DisconnectReason.loggedOut) startVSTBOT()
        } else if (connection === "open") {
            console.log("✅ VSTBOT BERHASIL TERHUBUNG!")
        }
    })

    // Sisa script command lu (menu, help, dll) taro di bawah sini...
}

startVSTBOT()
