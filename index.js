const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    generateForwardMessageContent, 
    prepareWAMessageMedia, 
    generateWAMessageFromContent, 
    generateMessageID, 
    downloadContentFromMessage, 
    makeInMemoryStore, 
    jidDecode, 
    proto 
} = require("@whiskeysockets/baileys")
const pino = require("pino")
const { Boom } = require("@hapi/boom")
const fs = require("fs")
const moment = require("moment-timezone")
const chalk = require("chalk")

// --- KONFIGURASI UTAMA ---
const ownerNumber = "62895405237107" // 👈 GANTI NOMOR LU (CONTOH: 62812345678)
const botName = "VSTBOT"

// DATABASE SEDERHANA
if (!fs.existsSync("./welcome.json")) fs.writeFileSync("./welcome.json", "{}")
if (!fs.existsSync("./goodbye.json")) fs.writeFileSync("./goodbye.json", "{}")
let welcomeDB = JSON.parse(fs.readFileSync("./welcome.json"))
let goodbyeDB = JSON.parse(fs.readFileSync("./goodbye.json"))

const saveDB = () => {
    fs.writeFileSync("./welcome.json", JSON.stringify(welcomeDB, null, 2))
    fs.writeFileSync("./goodbye.json", JSON.stringify(goodbyeDB, null, 2))
}

async function startVST() {
    const { state, saveCreds } = await useMultiFileAuthState("./vst_session")
    const { version } = await fetchLatestBaileysVersion()
    
    const client = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: false, // QR dimatiin biar gak menuhin log
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"], // Browser stabil anti-428
        version
    })

    // --- FITUR PAIRING CODE (ANTI RIBET) ---
    if (!client.authState.creds.registered) {
        console.log(chalk.cyan("⏳ Menunggu 10 detik untuk Generate Pairing Code..."))
        setTimeout(async () => {
            let code = await client.requestPairingCode(ownerNumber)
            code = code?.match(/.{1,4}/g)?.join("-") || code
            console.log(chalk.black(chalk.bgGreen(" KODE PAIRING VSTBOT LU: ")))
            console.log(chalk.black(chalk.bgWhite(`      ${code}      `)))
        }, 10000)
    }

    client.ev.on("creds.update", saveCreds)

    // --- WELCOME & GOODBYE LOGIC ---
    client.ev.on("group-participants.update", async (anu) => {
        const { id, participants, action } = anu
        for (let num of participants) {
            let userTag = `@${num.split("@")[0]}`
            if (action === "add" && welcomeDB[id]) {
                let msg = welcomeDB[id].replace("@user", userTag)
                client.sendMessage(id, { text: msg, mentions: [num] })
            } else if (action === "remove" && goodbyeDB[id]) {
                let msg = goodbyeDB[id].replace("@user", userTag)
                client.sendMessage(id, { text: msg, mentions: [num] })
            }
        }
    })

    // --- MESSAGE HANDLER ---
    client.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe) return
        const from = msg.key.remoteJid
        const type = Object.keys(msg.message)[0]
        const body = (type === 'conversation') ? msg.message.conversation : (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : ''
        const prefix = /^[./!#]/.test(body) ? body.match(/^[./!#]/)[0] : ''
        const isCmd = body.startsWith(prefix)
        const command = isCmd ? body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase() : ''
        const args = body.trim().split(/ +/).slice(1)
        const q = args.join(" ")

        if (isCmd) {
            console.log(chalk.green(`[COMMAND] ${command} from ${msg.pushName}`))
            
            switch(command) {
                case "menu":
                case "help":
                    const menu = `
┏━━━ ✨ *${botName} SUPREME* ✨ ━━━┓
┃
┃ 🕒 *Waktu:* ${moment().tz("Asia/Jakarta").format("HH:mm:ss")} WIB
┃ 📅 *Tanggal:* ${moment().tz("Asia/Jakarta").format("DD/MM/YYYY")}
┃
┣━━━ 👤 *USER INFO* ━━━
┃ 📝 Nama: ${msg.pushName || "User"}
┃ 🆔 JID: ${from.split('@')[0]}
┃
┣━━━ 🛡️ *GROUP SETTINGS* ━━━
┃ ✅ ${prefix}setwelcome [teks]
┃ ✅ ${prefix}setgoodbye [teks]
┃ 💡 _Gunakan @user untuk ngetag_
┃
┣━━━ ⚙️ *SYSTEM VST* ━━━
┃ ⚡ ${prefix}ping - Speed Test
┃ ⏳ ${prefix}runtime - Uptime Bot
┃ 👤 ${prefix}owner - Kontak Master
┗━━━━━━━━━━━━━━━━━━━━┛`
                    await client.sendMessage(from, { text: menu }, { quoted: msg })
                    break

                case "setwelcome":
                    if (!q) return client.sendMessage(from, { text: `Contoh: ${prefix}setwelcome Selamat datang @user di grup!` })
                    welcomeDB[from] = q
                    saveDB()
                    client.sendMessage(from, { text: "✅ Teks Welcome VSTBOT Berhasil Disimpan!" })
                    break

                case "setgoodbye":
                    if (!q) return client.sendMessage(from, { text: `Contoh: ${prefix}setgoodbye Cabut lu @user!` })
                    goodbyeDB[from] = q
                    saveDB()
                    client.sendMessage(from, { text: "✅ Teks Goodbye VSTBOT Berhasil Disimpan!" })
                    break

                case "ping":
                    await client.sendMessage(from, { text: "*VSTBOT Response:* ⚡ _FAST AS LIGHTNING!_" })
                    break

                case "runtime":
                    const uptime = process.uptime()
                    const h = Math.floor(uptime / 3600)
                    const m = Math.floor((uptime % 3600) / 60)
                    const s = Math.floor(uptime % 60)
                    await client.sendMessage(from, { text: `*VSTBOT Uptime:* ${h} Jam, ${m} Menit, ${s} Detik` })
                    break

                case "owner":
                    client.sendMessage(from, { text: `Owner VSTBOT: https://wa.me/${ownerNumber.replace('62', '0')}` })
                    break
            }
        }
    })

    client.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update
        if (connection === "close") {
            const reason = new Boom(lastDisconnect?.error)?.output.statusCode
            if (reason !== DisconnectReason.loggedOut) startVST()
        } else if (connection === "open") {
            console.log(chalk.bgCyan(" ✅ VSTBOT SUPREME IS ONLINE NOW! "))
        }
    })
}

startVST()
