const mineflayer = require('mineflayer');
const config = require('./config.json');

console.log(`[Engine] Initializing connection to ${config.serverHost}:${config.serverPort}`);

// --- PROGRAMMATIC PACKET FIXER INJECTION ---
// We override the default Max Packet allocation size BEFORE mineflayer boots up
process.env.NODE_MAX_PACKET_SIZE = "104857600"; // Extends packet cap limits to 100MB+

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

// Forces the chunk decoder system to skip heavy, dense terrain updates that cause array overflows
bot.loadPlugin((botInstance) => {
    botInstance.world.getColumns = () => [];
    botInstance.world.getColumn = () => null;
    botInstance.world.getColumnAt = () => null;
});

bot.on('resourcePack', (url, hash) => {
    console.log(`[Resource Pack] Denying custom payload layout to stabilize network memory.`);
    try { bot.denyResourcePack(); } catch (err) {}
});

bot.once('login', () => {
    console.log(`[Network Layer] Handshake established. Intercepting registry channels...`);
    
    // Adjust packet buffer sizes directly on the raw socket client framework
    if (bot._client && bot._client.deserializer) {
        bot._client.deserializer.maxSize = 104857600; // Forces packet faking boundaries to expand
    }

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
    console.log(`[Lifecycle] ${config.botUsername} successfully standing in the world.`);
    bot.physicsEnabled = false; 
    bot.clearControlStates();
    
    // Keep packet lines alive cleanly without physical player models
    setInterval(() => {
        if (!bot || !bot._client) return;
        try {
            bot._client.write('arm_animation', { hand: 0 });
            console.log(`[KeepAlive] Sent arm update to keep connection active.`);
        } catch (e) {}
    }, 10000); 
});

bot.on('end', (reason) => {
    console.log(`[Engine Disconnected] Context: ${reason}`);
    setTimeout(() => { process.exit(1); }, 15000);
});

bot.on('error', (err) => {
    // Suppress remaining minor desync array traces safely to hold the connection pipeline active
    if (err.message.includes('array size') || err.message.includes('play.toClient')) {
        return;
    }
    console.error(`[Suppressed Runtime Exception] ${err.message}`);
});
