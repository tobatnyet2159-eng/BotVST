const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion 
} = require("@whiskeysockets/baileys")
const pino = require("pino")
const { Boom } = require("@hapi/boom")
const qrcode = require("qrcode-terminal")
const fs = require("fs")
const moment = require("moment-timezone")

// Database Sederhana
const welcomeDB = JSON.parse(fs.readFileSync("./welcome.json"))
const goodbyeDB = JSON.parse(fs.readFileSync("./goodbye.json"))

async function startVST() {
    const { state, saveCreds } = await useMultiFileAuthState("./vst_qr_session")
    
    const client = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: state,
        printQRInTerminal: false,
        browser: ["VST-BOT", "MacOS", "3.0.0"]
    })

    client.ev.on("creds.update", saveCreds)

    // Fitur Welcome & Goodbye
    client.ev.on("group-participants.update", async (anu) => {
        const { id, participants, action } = anu
        for (let num of participants) {
            let userTag = `@${num.split("@")[0]}`
            if (action === "add" && welcomeDB[id]) {
                client.sendMessage(id, { text: welcomeDB[id].replace("@user", userTag), mentions: [num] })
            } else if (action === "remove" && goodbyeDB[id]) {
                client.sendMessage(id, { text: goodbyeDB[id].replace("@user", userTag), mentions: [num] })
            }
        }
    })

    // Message Handler (Command)
    client.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe) return
        const from = msg.key.remoteJid
        const type = Object.keys(msg.message)[0]
        const body = (type === 'conversation') ? msg.message.conversation : (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : ''
        const prefix = "."
        const isCmd = body.startsWith(prefix)
        const command = isCmd ? body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase() : ''
        const args = body.trim().split(/ +/).slice(1)
        const q = args.join(" ")

        if (isCmd) {
            switch(command) {
                case "menu":
                    const txtMenu = `*VST-BOT MULTI DEVICE*\n\n` +
                        `🕒 *Waktu:* ${moment().tz("Asia/Jakarta").format("HH:mm:ss")}\n` +
                        `📅 *Tanggal:* ${moment().tz("Asia/Jakarta").format("DD/MM/YYYY")}\n\n` +
                        `*GROUP COMMANDS:*\n` +
                        `> ${prefix}setwelcome [teks]\n` +
                        `> ${prefix}setgoodbye [teks]\n\n` +
                        `*OTHERS:*\n` +
                        `> ${prefix}ping\n` +
                        `> ${prefix}runtime\n` +
                        `> ${prefix}owner`
                    client.sendMessage(from, { text: txtMenu }, { quoted: msg })
                    break

                case "ping":
                    client.sendMessage(from, { text: "_Pong!! Speed: Fast as f*ck!_" }, { quoted: msg })
                    break

                case "setwelcome":
                    if (!q) return client.sendMessage(from, { text: "Masukin teksnya, Bre! Contoh: .setwelcome Welcome @user" })
                    welcomeDB[from] = q
                    fs.writeFileSync("./welcome.json", JSON.stringify(welcomeDB))
                    client.sendMessage(from, { text: "✅ Teks Welcome Berhasil Diatur!" })
                    break

                case "runtime":
                    const uptime = process.uptime()
                    const h = Math.floor(uptime / 3600)
                    const m = Math.floor((uptime % 3600) / 60)
                    const s = Math.floor(uptime % 60)
                    client.sendMessage(from, { text: `*Runtime:* ${h}j ${m}m ${s}d` })
                    break
            }
        }
    })

    client.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update
        if (qr) {
            console.clear()
            console.log("=== SCAN QR DI BAWAH INI ===")
            qrcode.generate(qr, { small: true })
        }
        if (connection === "close") {
            const reason = new Boom(lastDisconnect?.error)?.output.statusCode
            if (reason !== DisconnectReason.loggedOut) startVST()
        } else if (connection === "open") {
            console.log("✅ BOT ONLINE!")
        }
    })
}

startVST()
