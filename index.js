// VSTBOT SUPREME - MULTI DEVICE
// South Jakarta Vibes: "No more kaku, ini VSTBOT beneran full power. Ghosting mode on."

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, jidDecode } = require("@whiskeysockets/baileys")
const Pino = require("pino")
const fs = require("fs")
const moment = require("moment-timezone")
const qrcodeTerminal = require("qrcode-terminal")

// DATABASE SEDERHANA
let welcomeDB = JSON.parse(fs.readFileSync("./welcome.json", "utf-8") || "{}")
let goodbyeDB = JSON.parse(fs.readFileSync("./goodbye.json", "utf-8") || "{}")

const saveDB = () => {
    fs.writeFileSync("./welcome.json", JSON.stringify(welcomeDB, null, 2))
    fs.writeFileSync("./goodbye.json", JSON.stringify(goodbyeDB, null, 2))
}

async function startVSTBOT() {
    const { state, saveCreds } = await useMultiFileAuthState("./vst_session")
    const client = makeWASocket({
        logger: Pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: true,
        browser: ["VSTBOT", "Chrome", "1.0.0"]
    })

    client.ev.on("creds.update", saveCreds)

    // --- LOGIC WELCOME & GOODBYE ---
    client.ev.on("group-participants.update", async (anu) => {
        const { id, participants, action } = anu
        for (let num of participants) {
            if (action === "add" && welcomeDB[id]) {
                let text = welcomeDB[id].replace("@user", `@${num.split("@")[0]}`)
                client.sendMessage(id, { text: text, mentions: [num] })
            } else if (action === "remove" && goodbyeDB[id]) {
                let text = goodbyeDB[id].replace("@user", `@${num.split("@")[0]}`)
                client.sendMessage(id, { text: text, mentions: [num] })
            }
        }
    })

    client.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe) return
        const from = msg.key.remoteJid
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim()
        const isCmd = body.startsWith(".") || body.startsWith("!")
        const prefix = isCmd ? body[0] : ""
        const command = isCmd ? body.slice(1).trim().split(/ +/).shift().toLowerCase() : ""
        const args = body.slice(1).trim().split(/ +/).slice(1)
        const q = args.join(" ")

        // --- COMMAND HANDLER ---
        if (isCmd) {
            switch(command) {
                case "menu":
                case "help":
                    const menu = `
┏━━━ ✨ *VSTBOT SUPREME* ✨ ━━━┓
┃
┃  👋 *Halo, User VST!*
┃  Waktu: ${moment().tz("Asia/Jakarta").format("HH:mm:ss")} WIB
┃
┣━━━ 👤 *INFO* ━━━
┃ 📝 Nama: VSTBOT v1.1
┃ 📡 Status: Online 24/7
┃
┣━━━ 🥷 *ASSASSIN ARTS* ━━━
┃ 🗡️ ${prefix}assassin - Cek status
┃ 🎯 ${prefix}track [user] - Info ID
┃
┣━━━ 🛡️ *GROUP ADMIN* ━━━
┃ ✅ ${prefix}setwelcome [teks]
┃ ✅ ${prefix}setgoodbye [teks]
┃ 💡 _Gunakan @user di dalam teks_
┃
┣━━━ ⚙️ *SYSTEM* ━━━
┃ 🔋 ${prefix}ping - Speed test
┃ 🚪 ${prefix}runtime - Uptime bot
┗━━━━━━━━━━━━━━━━━━━━┛`
                    await client.sendMessage(from, { text: menu }, { quoted: msg })
                    break

                case "setwelcome":
                    if (!q) return client.sendMessage(from, { text: "Contoh: .setwelcome Halo @user, selamat datang di VST Group!" })
                    welcomeDB[from] = q
                    saveDB()
                    client.sendMessage(from, { text: "✅ Teks Welcome VSTBOT Berhasil Diset!" })
                    break

                case "setgoodbye":
                    if (!q) return client.sendMessage(from, { text: "Contoh: .setgoodbye Selamat tinggal @user, jangan lupa balik lagi!" })
                    goodbyeDB[from] = q
                    saveDB()
                    client.sendMessage(from, { text: "✅ Teks Goodbye VSTBOT Berhasil Diset!" })
                    break

                case "ping":
                    await client.sendMessage(from, { text: "VSTBOT Response: *⚡ FAST AS LIGHTNING*" })
                    break

                case "runtime":
                    const uptime = process.uptime()
                    await client.sendMessage(from, { text: `VSTBOT Aktif Selama: *${Math.floor(uptime/3600)} Jam*` })
                    break

                default:
                    if (isCmd) client.sendMessage(from, { text: "Command gak ada di database VSTBOT." })
            }
        }
    })

    client.ev.on("connection.update", (upd) => {
        const { connection, lastDisconnect } = upd
        if (connection === "open") console.log("--- VSTBOT SUPREME ONLINE ---")
        if (connection === "close") startVSTBOT()
    })
}

startVSTBOT()
