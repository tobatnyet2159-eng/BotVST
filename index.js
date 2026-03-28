const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeInMemoryStore 
} = require("@whiskeysockets/baileys")
const pino = require("pino")
const { Boom } = require("@hapi/boom")
const fs = require("fs")

const phoneNumber = "62895405237107" // 👈 WAJIB GANTI NOMOR LU LAGI DI SINI!

async function startVST() {
    const { state, saveCreds } = await useMultiFileAuthState("./vst_session")
    
    const client = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: state,
        // PAKAI USER AGENT TERBARU BIAR GAK DI-BLOCK (ERROR 428)
        browser: ["Chrome (Android)", "VST-PRO", "24.0.0"],
        syncFullHistory: false
    })

    // PAIRING CODE LOGIC DENGAN DELAY LEBIH LAMA
    if (!client.authState.creds.registered) {
        console.log("⏳ Menunggu 15 detik biar server tenang...")
        setTimeout(async () => {
            try {
                let code = await client.requestPairingCode(phoneNumber)
                code = code?.match(/.{1,4}/g)?.join("-") || code
                console.log("┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓")
                console.log("┃       KODE PAIRING VSTBOT LU:          ┃")
                console.log(`┃           ${code}             ┃`)
                console.log("┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛")
            } catch (err) {
                console.log("❌ Gagal request kode. Coba restart Railway lu 5 menit lagi.")
            }
        }, 15000) // Delay 15 detik biar nggak dianggap spam
    }

    client.ev.on("creds.update", saveCreds)

    client.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update
        if (connection === "close") {
            const reason = new Boom(lastDisconnect?.error)?.output.statusCode
            console.log(`Koneksi putus: ${reason}. Mencoba lagi...`)
            if (reason !== DisconnectReason.loggedOut) startVST()
        } else if (connection === "open") {
            console.log("✅ VSTBOT ONLINE!")
        }
    })
}

startVST()
