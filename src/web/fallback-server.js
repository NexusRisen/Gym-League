const express = require('express');
const gymConfig = require('../config/gymConfig');

class FallbackWebServer {
    constructor(database, discordClient = null) {
        this.app = express();
        this.db = database;
        this.client = discordClient;
        this.port = process.env.WEB_PORT || 3000;
        this.host = process.env.WEB_HOST || 'localhost';
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // Add CORS headers
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });
    }

    setupRoutes() {
        // API endpoint for getting guild list
        this.app.get('/api/guilds', (req, res) => {
            try {
                if (!this.client || !this.client.guilds) {
                    return res.json({
                        success: false,
                        error: 'Discord client not available'
                    });
                }

                const guilds = this.client.guilds.cache.map(guild => ({
                    id: guild.id,
                    name: guild.name,
                    icon: guild.iconURL({ dynamic: true, size: 64 }),
                    memberCount: guild.memberCount
                }));

                res.json({
                    success: true,
                    guilds: guilds
                });
            } catch (error) {
                console.error('Error fetching guilds:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to fetch guild list'
                });
            }
        });

        // Main page with inline HTML
        this.app.get('/', async (req, res) => {
            try {
                const guildId = req.query.guild;
                
                if (!guildId) {
                    // Get available guilds for dropdown
                    let availableGuilds = [];
                    if (this.client && this.client.guilds) {
                        availableGuilds = this.client.guilds.cache.map(guild => ({
                            id: guild.id,
                            name: guild.name,
                            icon: guild.iconURL({ dynamic: true, size: 64 }),
                            memberCount: guild.memberCount
                        }));
                    }
                    return res.send(this.getGuildSelectHTML(availableGuilds));
                }

                const leaderboard = await this.db.getLeaderboard(guildId);
                const guild = await this.db.getGuild(guildId);
                
                // Get badge details for each trainer
                for (let trainer of leaderboard) {
                    trainer.badges = await this.db.getTrainerBadges(trainer.id);
                }

                res.send(this.getLeaderboardHTML(guild, leaderboard));
                
            } catch (error) {
                console.error('Error rendering leaderboard:', error);
                res.status(500).send(this.getErrorHTML('Failed to load leaderboard', error.message));
            }
        });

        // API endpoint for leaderboard data
        this.app.get('/api/leaderboard/:guildId', async (req, res) => {
            try {
                const { guildId } = req.params;
                const leaderboard = await this.db.getLeaderboard(guildId);
                
                for (let trainer of leaderboard) {
                    trainer.badges = await this.db.getTrainerBadges(trainer.id);
                }

                res.json({
                    success: true,
                    data: leaderboard
                });
            } catch (error) {
                console.error('API Error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to fetch leaderboard data'
                });
            }
        });

        // Trainer profile
        this.app.get('/trainer/:trainerId', async (req, res) => {
            try {
                const { trainerId } = req.params;
                const trainer = await this.db.getTrainer(trainerId);
                
                if (!trainer) {
                    return res.status(404).send(this.getErrorHTML('Trainer not found'));
                }

                const badges = await this.db.getTrainerBadges(trainerId);
                res.send(this.getTrainerProfileHTML(trainer, badges));
                
            } catch (error) {
                console.error('Error rendering trainer profile:', error);
                res.status(500).send(this.getErrorHTML('Failed to load trainer profile', error.message));
            }
        });

        // Gym information
        this.app.get('/gyms', (req, res) => {
            res.send(this.getGymsHTML());
        });

        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                mode: 'fallback'
            });
        });

        // 404 handler
        this.app.use((req, res) => {
            res.status(404).send(this.getErrorHTML('Page not found'));
        });
    }

    getBaseHTML(title, content) {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    min-height: 100vh; 
                    color: white; 
                    line-height: 1.6;
                }
                .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; margin-bottom: 40px; }
                .title { font-size: 3rem; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
                .subtitle { font-size: 1.2rem; opacity: 0.9; }
                .card { 
                    background: rgba(255, 255, 255, 0.1); 
                    backdrop-filter: blur(10px);
                    border-radius: 15px; 
                    padding: 25px; 
                    margin: 20px 0; 
                    box-shadow: 0 8px 25px rgba(0,0,0,0.2);
                }
                .trainer-card {
                    background: rgba(255, 255, 255, 0.15);
                    border-radius: 12px;
                    padding: 20px;
                    margin: 15px 0;
                    display: flex;
                    align-items: center;
                    gap: 20px;
                }
                .rank { 
                    font-size: 1.5rem; 
                    font-weight: bold; 
                    background: rgba(255,255,255,0.2);
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .trainer-info { flex: 1; }
                .trainer-name { font-size: 1.3rem; font-weight: 600; margin-bottom: 5px; }
                .badge-count { opacity: 0.8; }
                .btn {
                    display: inline-block;
                    padding: 12px 24px;
                    background: rgba(255,255,255,0.2);
                    color: white;
                    text-decoration: none;
                    border-radius: 8px;
                    transition: all 0.3s ease;
                    border: 1px solid rgba(255,255,255,0.3);
                }
                .btn:hover {
                    background: rgba(255,255,255,0.3);
                    transform: translateY(-2px);
                }
                .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
                .gym-card {
                    background: rgba(255,255,255,0.1);
                    border-radius: 12px;
                    padding: 20px;
                    text-align: center;
                }
                .gym-emoji { font-size: 2rem; margin-bottom: 10px; }
                .badge-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin: 15px 0;
                }
                .badge-item {
                    background: rgba(255,255,255,0.2);
                    padding: 5px 12px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                }
                .empty { text-align: center; padding: 40px; opacity: 0.7; }
                .error { background: rgba(231, 76, 60, 0.8); }
                code { background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 4px; }
                @media (max-width: 768px) { 
                    .title { font-size: 2rem; } 
                    .trainer-card { flex-direction: column; text-align: center; }
                    .grid { grid-template-columns: 1fr; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                ${content}
            </div>
        </body>
        </html>
        `;
    }

    getGuildSelectHTML(guilds = []) {
        const guildOptions = guilds.map(guild => 
            `<option value="${guild.id}" data-icon="${guild.icon || ''}">${guild.name} (${guild.memberCount} members)</option>`
        ).join('');

        return this.getBaseHTML('Pokemon Gym League - Select Server', `
            <div class="header">
                <h1 class="title">🏆 Pokemon Gym League</h1>
                <p class="subtitle">Select a Discord Server</p>
            </div>
            
            ${guilds.length > 0 ? `
                <div class="card">
                    <h2>🎯 Choose Your Server</h2>
                    <select id="guildSelect" style="width: 100%; padding: 15px; font-size: 1rem; border: none; border-radius: 10px; background: rgba(255,255,255,0.9); color: #333; margin: 20px 0; cursor: pointer;">
                        <option value="">Choose a server...</option>
                        ${guildOptions}
                    </select>
                    
                    <button onclick="viewLeaderboard()" id="viewBtn" disabled style="background: linear-gradient(145deg, #3498db, #2980b9); color: white; border: none; padding: 15px 30px; font-size: 1rem; border-radius: 10px; cursor: pointer; transition: all 0.3s ease; width: 100%; margin-top: 15px;">
                        🏆 View Leaderboard
                    </button>
                    
                    <div id="loading" style="display: none; margin-top: 20px; color: #3498db;">
                        🔄 Loading leaderboard...
                    </div>
                </div>
                
                <div class="card">
                    <h3>📊 Quick Stats</h3>
                    <p><strong>${guilds.length}</strong> servers connected</p>
                    <p><strong>${guilds.reduce((total, guild) => total + guild.memberCount, 0)}</strong> total members</p>
                </div>
                
                <script>
                    const select = document.getElementById('guildSelect');
                    const btn = document.getElementById('viewBtn');
                    const loading = document.getElementById('loading');

                    select.addEventListener('change', function() {
                        btn.disabled = !this.value;
                        if (this.value) {
                            const selectedOption = this.options[this.selectedIndex];
                            const serverName = selectedOption.text.split(' (')[0];
                            btn.innerHTML = '🏆 View ' + serverName + ' Leaderboard';
                        } else {
                            btn.innerHTML = '🏆 View Leaderboard';
                        }
                    });

                    function viewLeaderboard() {
                        const guildId = select.value;
                        if (!guildId) return;
                        
                        btn.style.display = 'none';
                        loading.style.display = 'block';
                        
                        setTimeout(() => {
                            window.location.href = '/?guild=' + guildId;
                        }, 500);
                    }

                    // Auto-select if there's only one server
                    if (select.options.length === 2) {
                        select.selectedIndex = 1;
                        select.dispatchEvent(new Event('change'));
                    }

                    // Keyboard support
                    select.addEventListener('keydown', function(e) {
                        if (e.key === 'Enter' && this.value) {
                            viewLeaderboard();
                        }
                    });
                </script>
            ` : `
                <div class="card error">
                    <h2>⚠️ No Servers Found</h2>
                    <p>The Pokemon Gym League bot is not connected to any Discord servers yet.</p>
                    <p>Please invite the bot to your server first!</p>
                </div>
            `}
        `);
    }

    getLeaderboardHTML(guild, leaderboard) {
        let content = `
            <div class="header">
                <h1 class="title">🏆 Pokemon Gym League</h1>
                <p class="subtitle">${guild ? guild.name : 'Server'} Leaderboard</p>
            </div>
        `;

        if (leaderboard.length === 0) {
            content += `
                <div class="card empty">
                    <h2>🎯 No trainers yet!</h2>
                    <p>Use <code>/setup</code> in Discord to initialize the gym league.</p>
                    <p>Then trainers can start challenging gym leaders!</p>
                </div>
            `;
        } else {
            content += `<div class="card">
                <h2>👥 Top Trainers</h2>
            `;
            
            leaderboard.slice(0, 10).forEach((trainer, index) => {
                const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
                const badgeCount = trainer.badge_count || 0;
                
                content += `
                    <div class="trainer-card">
                        <div class="rank">${rankEmoji}</div>
                        <div class="trainer-info">
                            <div class="trainer-name">${trainer.display_name || trainer.username}</div>
                            <div class="badge-count">🏅 ${badgeCount} badges earned</div>
                        </div>
                        <a href="/trainer/${trainer.id}" class="btn">View Profile</a>
                    </div>
                `;
            });
            
            content += `</div>`;
        }

        content += `
            <div class="card">
                <h2>🔗 Quick Links</h2>
                <a href="/gyms" class="btn" style="margin: 5px;">🏠 View All Gyms</a>
                <a href="/api/leaderboard/${guild ? guild.id : 'unknown'}" class="btn" style="margin: 5px;">📊 API Data</a>
                <a href="/health" class="btn" style="margin: 5px;">❤️ Health Check</a>
            </div>
        `;

        return this.getBaseHTML('Leaderboard', content);
    }

    getTrainerProfileHTML(trainer, badges) {
        let content = `
            <div class="header">
                <h1 class="title">👤 ${trainer.display_name || trainer.username}</h1>
                <p class="subtitle">Trainer Profile</p>
            </div>
            
            <div class="card">
                <h2>📊 Progress</h2>
                <p><strong>Total Badges:</strong> ${badges.length}</p>
                <p><strong>Trainer Since:</strong> ${new Date(trainer.created_at).toLocaleDateString()}</p>
            </div>
        `;

        if (badges.length > 0) {
            content += `
                <div class="card">
                    <h2>🏅 Badge Collection</h2>
                    <div class="badge-list">
            `;
            
            badges.forEach(badge => {
                const gymInfo = [...gymConfig.gyms, ...gymConfig.eliteFour].find(g => g.type === badge.gym_type) || gymConfig.champion;
                content += `
                    <div class="badge-item">
                        ${gymInfo ? gymInfo.emoji : '🏅'} ${badge.gym_name}
                    </div>
                `;
            });
            
            content += `
                    </div>
                </div>
            `;
        } else {
            content += `
                <div class="card empty">
                    <h2>🎯 No badges yet!</h2>
                    <p>Start your Pokemon journey by challenging gym leaders!</p>
                </div>
            `;
        }

        content += `
            <div class="card">
                <a href="/?guild=${trainer.guild_id}" class="btn">← Back to Leaderboard</a>
            </div>
        `;

        return this.getBaseHTML('Trainer Profile', content);
    }

    getGymsHTML() {
        let content = `
            <div class="header">
                <h1 class="title">🏠 Pokemon Gyms</h1>
                <p class="subtitle">Challenge Information</p>
            </div>
            
            <div class="card">
                <h2>🎯 Regular Gyms (${gymConfig.gyms.length})</h2>
                <div class="grid">
        `;

        gymConfig.gyms.forEach(gym => {
            content += `
                <div class="gym-card">
                    <div class="gym-emoji">${gym.emoji}</div>
                    <h3>${gym.name}</h3>
                    <p><strong>${gym.type.toUpperCase()} TYPE</strong></p>
                    <p>${gym.description}</p>
                </div>
            `;
        });

        content += `
                </div>
            </div>
            
            <div class="card">
                <h2>⭐ Elite Four (${gymConfig.eliteFour.length})</h2>
                <div class="grid">
        `;

        gymConfig.eliteFour.forEach(elite => {
            content += `
                <div class="gym-card">
                    <div class="gym-emoji">${elite.emoji}</div>
                    <h3>${elite.name}</h3>
                    <p><strong>ELITE FOUR</strong></p>
                    <p>${elite.description}</p>
                </div>
            `;
        });

        content += `
                </div>
            </div>
            
            <div class="card">
                <h2>👑 Champion</h2>
                <div class="gym-card">
                    <div class="gym-emoji">${gymConfig.champion.emoji}</div>
                    <h3>${gymConfig.champion.name}</h3>
                    <p><strong>CHAMPION</strong></p>
                    <p>${gymConfig.champion.description}</p>
                </div>
            </div>
            
            <div class="card">
                <a href="/" class="btn">← Back to Leaderboard</a>
            </div>
        `;

        return this.getBaseHTML('Pokemon Gyms', content);
    }

    getErrorHTML(error, details = '') {
        let content = `
            <div class="header">
                <h1 class="title">❌ Error</h1>
                <p class="subtitle">Something went wrong</p>
            </div>
            
            <div class="card error">
                <h2>Error Details</h2>
                <p><strong>Error:</strong> ${error}</p>
                ${details ? `<p><strong>Details:</strong> ${details}</p>` : ''}
            </div>
            
            <div class="card">
                <a href="/" class="btn">← Back to Home</a>
            </div>
        `;

        return this.getBaseHTML('Error', content);
    }

    start() {
        this.server = this.app.listen(this.port, this.host, () => {
            console.log(`🌐 Fallback web server running at http://${this.host}:${this.port}`);
        });
        return this.server;
    }

    stop() {
        if (this.server) {
            this.server.close();
        }
    }
}

module.exports = FallbackWebServer;