const mineflayer = require('mineflayer');
const config = require('./config.json');

console.log(`[Engine] Initializing clean connection frame to ${config.serverHost}:${config.serverPort}`);

const bot = mineflayer.createBot({
    host: config.serverHost,
    port: config.serverPort,
    username: config.botUsername,
    version: "1.21.1",
    auth: "offline",
    brand: "vanilla",
    respawn: true,
    physicsEnabled: false // Lock states until spawned inside dimensions safely
});

// --- MODERN MOD REJECTION PACKET BYPASS ---
bot.once('login', () => {
    console.log(`[Network Layer] Handshake established. Intercepting registry channels...`);
    const client = bot._client;
    if (client) {
        client.on('custom_payload', (packet) => {
            if (packet.channel === 'minecraft:register' || packet.channel === 'fabric:registry/sync' || packet.channel === 'fml:handshake') {
                try {
                    client.write('custom_payload', {
                        channel: packet.channel,
                        data: Buffer.alloc(0)
                    });
                    console.log(`[Bypass Layer] Answered registry channel check: ${packet.channel}`);
                } catch (err) {
                    console.error(`[Bypass Error] Failed packet response payload generation`);
                }
            }
        });
    }
});

bot.on('spawn', () => {
    console.log(`[Lifecycle] ${config.botUsername} successfully localized inside chunks.`);
    bot.physicsEnabled = true; // Safe to wake up gravity engine maps
    bot.clearControlStates();
    
    // Trigger simple movement routines
    setInterval(() => {
        if (!bot || !bot.entity) return;
        bot.setControlState('jump', true);
        setTimeout(() => bot.setControlState('jump', false), 400);
    }, 20000);
});

bot.on('end', (reason) => {
    console.log(`[Engine Connection Dropped] Context: ${reason}`);
    console.log(`[Engine Cycle] Cooldown active. Restarting process thread in 15 seconds...`);
    setTimeout(() => {
        process.exit(1); // Forces your host panel runner to cleanly reboot the script
    }, 15000);
});

bot.on('error', (err) => {
    console.error(`[Runtime Exception] ${err.message}`);
});
