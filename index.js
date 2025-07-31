require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const express = require('express');
const path = require('path');
const fs = require('fs');

// Import modules
const Database = require('./src/database/database');
const { loadCommands } = require('./src/utils/commandLoader');
const { loadEvents } = require('./src/utils/eventLoader');

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Initialize collections
client.commands = new Collection();

// Initialize database
const db = new Database();

async function startBot() {
    try {
        console.log('🚀 Starting Pokemon Gym League Bot...');
        
        // Initialize database
        await db.initialize();
        console.log('✅ Database initialized');

        // Load commands and events
        await loadCommands(client);
        await loadEvents(client, db);
        console.log('✅ Commands and events loaded');

        // Start Discord bot
        await client.login(process.env.DISCORD_TOKEN);
        console.log('✅ Discord bot logged in');

        // Start web server with error handling
        try {
            await startWebServer();
            console.log('✅ Web server started');
        } catch (webError) {
            console.warn('⚠️  Web server failed to start:', webError.message);
            console.log('📱 Discord bot will continue running without web interface');
        }

        console.log('🎉 Pokemon Gym League Bot is operational!');
        console.log(`📊 Serving ${client.guilds.cache.size} servers`);
        console.log(`👥 Ready for ${client.users.cache.size} users`);
        
    } catch (error) {
        console.error('❌ Error starting bot:', error);
        process.exit(1);
    }
}

async function startWebServer() {
    return new Promise((resolve, reject) => {
        try {
            // Try to load the full web server first
            const WebServer = require('./src/web/server');
            const webServer = new WebServer(db, client);
            webServer.start();
            console.log('✅ Full web server with templates started');
            resolve();
        } catch (error) {
            console.log('⚠️  Full web server failed, trying fallback...', error.message);
            
            try {
                // Try fallback server
                const FallbackWebServer = require('./src/web/fallback-server');
                const fallbackServer = new FallbackWebServer(db, client);
                fallbackServer.start();
                console.log('✅ Fallback web server started (no templates needed)');
                resolve();
            } catch (fallbackError) {
                console.log('⚠️  Fallback server failed, trying minimal server...');
                
                // Minimal Express server as last resort
                const app = require('express')();
                const port = process.env.WEB_PORT || 3000;
                
                app.get('/', (req, res) => {
                    res.send(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Pokemon Gym League</title>
                            <style>
                                body { font-family: Arial; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; }
                                .container { max-width: 600px; margin: 0 auto; }
                                .card { background: rgba(255,255,255,0.1); padding: 30px; border-radius: 20px; margin: 20px 0; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <h1>🏆 Pokemon Gym League</h1>
                                <div class="card">
                                    <h2>✅ Discord Bot is Online!</h2>
                                    <p>The Pokemon Gym League bot is running successfully.</p>
                                    <p>🎮 Use <code>/setup</code> in Discord to initialize the gym league.</p>
                                    <p>📱 Web interface is in minimal mode.</p>
                                </div>
                                <div class="card">
                                    <h3>Available Commands:</h3>
                                    <p><code>/setup</code> - Initialize gym league</p>
                                    <p><code>/profile</code> - View your profile</p>
                                    <p><code>/badges</code> - See your badges</p>
                                    <p><code>/leaderboard</code> - Server rankings</p>
                                    <p><code>/help</code> - Get help</p>
                                </div>
                            </div>
                        </body>
                        </html>
                    `);
                });
                
                app.get('/health', (req, res) => {
                    res.json({ status: 'healthy', bot: 'running', mode: 'minimal' });
                });
                
                app.listen(port, () => {
                    console.log(`✅ Minimal web server at http://localhost:${port}`);
                    resolve();
                });
            }
        }
    });
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Pokemon Gym League Bot...');
    if (client) client.destroy();
    if (db) db.close();
    process.exit(0);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    process.exit(1);
});

// Start the bot
startBot();