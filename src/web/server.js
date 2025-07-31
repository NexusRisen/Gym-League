const express = require('express');
const path = require('path');
const gymConfig = require('../config/gymConfig');

class WebServer {
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
        // Ensure directories exist
        const viewsPath = path.join(__dirname, 'views');
        const publicPath = path.join(__dirname, 'public');
        
        if (!require('fs').existsSync(viewsPath)) {
            require('fs').mkdirSync(viewsPath, { recursive: true });
        }
        
        if (!require('fs').existsSync(publicPath)) {
            require('fs').mkdirSync(publicPath, { recursive: true });
        }

        // Set view engine
        this.app.set('view engine', 'ejs');
        this.app.set('views', viewsPath);
        
        // Static files
        this.app.use(express.static(publicPath));
        
        // Body parser
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
    }

    setupRoutes() {
        // Main leaderboard page
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

                    // Check if template exists, otherwise send simple HTML
                    const viewsPath = path.join(__dirname, 'views', 'guild-select.ejs');
                    if (require('fs').existsSync(viewsPath)) {
                        return res.render('guild-select', { guilds: availableGuilds });
                    } else {
                        return res.send(this.getGuildSelectHTML(availableGuilds));
                    }
                }

                const leaderboard = await this.db.getLeaderboard(guildId);
                const guild = await this.db.getGuild(guildId);
                
                // Get badge details for each trainer
                for (let trainer of leaderboard) {
                    trainer.badges = await this.db.getTrainerBadges(trainer.id);
                }

                // Check if template exists
                const leaderboardPath = path.join(__dirname, 'views', 'leaderboard.ejs');
                if (require('fs').existsSync(leaderboardPath)) {
                    res.render('leaderboard', {
                        guild,
                        leaderboard,
                        gymConfig
                    });
                } else {
                    // Send JSON data if template doesn't exist
                    res.json({
                        message: 'Pokemon Gym League Leaderboard (JSON Mode)',
                        guild: guild,
                        leaderboard: leaderboard,
                        totalTrainers: leaderboard.length,
                        note: 'Templates not found - showing raw data'
                    });
                }
            } catch (error) {
                console.error('Error rendering leaderboard:', error);
                res.status(500).json({ 
                    error: 'Failed to load leaderboard', 
                    details: error.message,
                    guildId: req.query.guild
                });
            }
        });

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
        this.app.get('/api/leaderboard/:guildId', async (req, res) => {
            try {
                const { guildId } = req.params;
                const leaderboard = await this.db.getLeaderboard(guildId);
                
                // Get badge details for each trainer
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

        // Trainer profile page
        this.app.get('/trainer/:trainerId', async (req, res) => {
            try {
                const { trainerId } = req.params;
                const trainer = await this.db.getTrainer(trainerId);
                
                if (!trainer) {
                    return res.status(404).json({ error: 'Trainer not found', trainerId });
                }

                const badges = await this.db.getTrainerBadges(trainerId);
                
                // Check if template exists
                const profilePath = path.join(__dirname, 'views', 'trainer-profile.ejs');
                if (require('fs').existsSync(profilePath)) {
                    res.render('trainer-profile', {
                        trainer,
                        badges,
                        gymConfig
                    });
                } else {
                    // Send JSON data if template doesn't exist
                    res.json({
                        message: 'Trainer Profile (JSON Mode)',
                        trainer: trainer,
                        badges: badges,
                        badgeCount: badges.length,
                        note: 'Template not found - showing raw data'
                    });
                }
            } catch (error) {
                console.error('Error rendering trainer profile:', error);
                res.status(500).json({ 
                    error: 'Failed to load trainer profile', 
                    details: error.message 
                });
            }
        });

        // Gym information page
        this.app.get('/gyms', (req, res) => {
            try {
                const gymsPath = path.join(__dirname, 'views', 'gyms.ejs');
                if (require('fs').existsSync(gymsPath)) {
                    res.render('gyms', { gymConfig });
                } else {
                    // Send JSON data if template doesn't exist
                    res.json({
                        message: 'Pokemon Gym Information (JSON Mode)',
                        gyms: gymConfig.gyms,
                        eliteFour: gymConfig.eliteFour,
                        champion: gymConfig.champion,
                        totalGyms: gymConfig.gyms.length,
                        note: 'Template not found - showing raw data'
                    });
                }
            } catch (error) {
                console.error('Error rendering gyms page:', error);
                res.status(500).json({ 
                    error: 'Failed to load gyms page', 
                    details: error.message 
                });
            }
        });

        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'healthy', timestamp: new Date().toISOString() });
        });

        // 404 handler
        this.app.use((req, res) => {
            const errorPath = path.join(__dirname, 'views', 'error.ejs');
            if (require('fs').existsSync(errorPath)) {
                res.status(404).render('error', { error: 'Page not found' });
            } else {
                res.status(404).json({ 
                    error: 'Page not found', 
                    path: req.path,
                    method: req.method,
                    availableRoutes: ['/', '/gyms', '/trainer/:id', '/api/leaderboard/:guildId', '/health']
                });
            }
        });
    }

    start() {
        this.server = this.app.listen(this.port, this.host, () => {
            console.log(`🌐 Web server running at http://${this.host}:${this.port}`);
        });
        return this.server;
    }

    getGuildSelectHTML(guilds = []) {
        const guildOptions = guilds.map(guild => 
            `<option value="${guild.id}" data-icon="${guild.icon || ''}">${guild.name} (${guild.memberCount} members)</option>`
        ).join('');

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Pokemon Gym League - Select Server</title>
                <style>
                    body { 
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        min-height: 100vh; 
                        color: white; 
                        margin: 0; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center;
                    }
                    .container { 
                        max-width: 500px; 
                        width: 90%; 
                        text-align: center; 
                    }
                    .card { 
                        background: rgba(255,255,255,0.1); 
                        backdrop-filter: blur(10px);
                        padding: 40px; 
                        border-radius: 20px; 
                        box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                    }
                    h1 { 
                        font-size: 2.5rem; 
                        margin-bottom: 10px; 
                        text-shadow: 2px 2px 4px rgba(0,0,0,0.3); 
                    }
                    .subtitle { 
                        opacity: 0.9; 
                        margin-bottom: 30px; 
                        font-size: 1.1rem; 
                    }
                    select { 
                        width: 100%; 
                        padding: 15px; 
                        font-size: 1rem; 
                        border: none; 
                        border-radius: 10px; 
                        background: rgba(255,255,255,0.9); 
                        color: #333; 
                        margin: 20px 0;
                        cursor: pointer;
                    }
                    select:focus { 
                        outline: none; 
                        box-shadow: 0 0 15px rgba(255,255,255,0.5); 
                    }
                    .btn { 
                        background: linear-gradient(145deg, #3498db, #2980b9); 
                        color: white; 
                        border: none; 
                        padding: 15px 30px; 
                        font-size: 1rem; 
                        border-radius: 10px; 
                        cursor: pointer; 
                        transition: all 0.3s ease;
                        margin-top: 15px;
                    }
                    .btn:hover { 
                        transform: translateY(-2px); 
                        box-shadow: 0 8px 20px rgba(52, 152, 219, 0.4); 
                    }
                    .btn:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                        transform: none;
                    }
                    .loading { 
                        display: none; 
                        margin-top: 20px; 
                        opacity: 0.8; 
                    }
                    .no-servers {
                        background: rgba(231, 76, 60, 0.2);
                        padding: 20px;
                        border-radius: 10px;
                        margin-top: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="card">
                        <h1>🏆 Pokemon Gym League</h1>
                        <p class="subtitle">Select a Discord Server</p>
                        
                        ${guilds.length > 0 ? `
                            <select id="guildSelect">
                                <option value="">Choose a server...</option>
                                ${guildOptions}
                            </select>
                            
                            <button class="btn" onclick="viewLeaderboard()" id="viewBtn" disabled>
                                View Leaderboard
                            </button>
                            
                            <div class="loading" id="loading">
                                🔄 Loading leaderboard...
                            </div>
                        ` : `
                            <div class="no-servers">
                                <h3>⚠️ No Servers Found</h3>
                                <p>The bot is not connected to any Discord servers yet.</p>
                                <p>Please invite the bot to your server first!</p>
                            </div>
                        `}
                    </div>
                </div>

                <script>
                    const select = document.getElementById('guildSelect');
                    const btn = document.getElementById('viewBtn');
                    const loading = document.getElementById('loading');

                    if (select) {
                        select.addEventListener('change', function() {
                            btn.disabled = !this.value;
                        });
                    }

                    function viewLeaderboard() {
                        const guildId = select.value;
                        if (!guildId) return;
                        
                        btn.style.display = 'none';
                        loading.style.display = 'block';
                        
                        // Redirect to leaderboard
                        window.location.href = '/?guild=' + guildId;
                    }

                    // Auto-redirect if there's only one server
                    if (select && select.options.length === 2) { // 2 because of "Choose a server..." option
                        select.selectedIndex = 1;
                        btn.disabled = false;
                        btn.innerHTML = 'View ' + select.options[1].text + ' Leaderboard';
                    }
                </script>
            </body>
            </html>
        `;
    }

    stop() {
        if (this.server) {
            this.server.close();
        }
    }
}

module.exports = WebServer;