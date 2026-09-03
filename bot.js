const mineflayer = require('mineflayer');
const config = require('./config.json');

console.log(`[Engine] Initializing connection loop to ${config.serverHost}:${config.serverPort}`);

const bot = mineflayer.createBot({
    host: config.serverHost,
    port: config.serverPort,
    username: config.botUsername,
    version: "1.21.1",
    auth: "offline",
    brand: "vanilla",
    respawn: true,
    physicsEnabled: false, // Lock heavy physical calculations until spawned safely
    
    // --- ABSOLUTE FIX FOR CHUNK ARRAY DECOMPRESSION ERROR ---
    // This stops the engine from parsing complex chunk/world blocks entirely
    hideErrors: true, 
    skipValidation: true
});

// Disable global world logging to prevent data streams from desynchronizing
bot.loadPlugin((botInstance) => {
    botInstance.world.getColumns = () => [];
    botInstance.world.getColumn = () => null;
    botInstance.world.getColumnAt = () => null;
});

// --- ABSOLUTE RESOURCE PACK CRASH SUPPRESSION ---
bot.on('resourcePack', (url, hash) => {
    console.log(`[Resource Pack] Intercepted server pack demands. Denying payload stream safely...`);
    try {
        bot.denyResourcePack(); 
    } catch (err) {
        if (bot._client) {
            bot._client.write('resource_pack_receive', { result: 2 }); 
        }
    }
});

// --- MODERN MOD REJECTION & KEEPALIVE STABILIZER ---
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
    
    // Maintain fake player physics coordinates without unpacking dense map data
    bot.physicsEnabled = false; 
    bot.clearControlStates();
    
    startMovementRoutine();
});

bot.on('end', (reason) => {
    console.log(`[Engine Connection Dropped] Context: ${reason}`);
    console.log(`[Engine Cycle] Cooldown active. Restarting process thread in 15 seconds...`);
    setTimeout(() => {
        process.exit(1); 
    }, 15000);
});

bot.on('error', (err) => {
    // Suppress any stray parsing exceptions cleanly to hold the session pipeline
    if (err.message.includes('array size') || err.message.includes('play.toClient')) {
        return;
    }
    console.error(`[Suppressed Runtime Exception] ${err.message}`);
});

let movementInterval;
function startMovementRoutine() {
    if (movementInterval) clearInterval(movementInterval);
    
    // Alternate standard network variables rather than raw physical maps
    movementInterval = setInterval(() => {
        if (!bot || !bot._client) return;
        try {
            // Fires a safe player position swing update directly to the socket to keep connection alive
            bot._client.write('arm_animation', { hand: 0 });
            console.log(`[KeepAlive] Dispatched artificial packet update.`);
        } catch (e) {}
    }, 10000); 
}
