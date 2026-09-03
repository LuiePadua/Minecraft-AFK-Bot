const mineflayer = require('mineflayer');
const config = require('./config.json');

console.log(`[Engine] Initializing connection to ${config.serverHost}:${config.serverPort}`);

const bot = mineflayer.createBot({
    host: config.serverHost,
    port: config.serverPort,
    username: config.botUsername,
    version: "1.21.1",
    auth: "offline",
    brand: "vanilla",
    respawn: true,
    physicsEnabled: false 
});

// --- ABSOLUTE RESOURCE PACK CRASH SUPPRESSION ---
// Stops the bot from parsing abnormally large image or block geometry packets
bot.on('resourcePack', (url, hash) => {
    console.log(`[Resource Pack] Intercepted server pack demands. Denying payload stream safely...`);
    try {
        bot.denyResourcePack(); // Safely rejects the download so the network array doesn't overload
    } catch (err) {
        // Fallback for older packet streams if API state locks down
        if (bot._client) {
            bot._client.write('resource_pack_receive', { result: 2 }); // Status 2 = Declined
        }
    }
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
                } catch (err) {}
            }
        });
    }
});

bot.on('spawn', () => {
    console.log(`[Lifecycle] ${config.botUsername} successfully localized inside chunks.`);
    bot.physicsEnabled = true; 
    bot.clearControlStates();
    
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
        process.exit(1); 
    }, 15000);
});

bot.on('error', (err) => {
    // Gracefully catch and log buffer limits instead of completely crashing the script engine
    console.error(`[Suppressed Runtime Exception] ${err.message}`);
});
