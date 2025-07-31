const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
    constructor() {
        this.dbPath = process.env.DB_PATH || './data/gym.db';
        this.db = null;
    }

    async initialize() {
        // Ensure data directory exists
        const dataDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            const createTablesSQL = `
                -- Guilds table
                CREATE TABLE IF NOT EXISTS guilds (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    category_id TEXT,
                    setup_completed BOOLEAN DEFAULT FALSE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                -- Gym channels table
                CREATE TABLE IF NOT EXISTS gym_channels (
                    id TEXT PRIMARY KEY,
                    guild_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL,
                    emoji TEXT,
                    is_open BOOLEAN DEFAULT TRUE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (guild_id) REFERENCES guilds (id)
                );

                -- Trainers table
                CREATE TABLE IF NOT EXISTS trainers (
                    id TEXT PRIMARY KEY,
                    guild_id TEXT NOT NULL,
                    username TEXT NOT NULL,
                    display_name TEXT,
                    total_badges INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (guild_id) REFERENCES guilds (id)
                );

                -- Badges table
                CREATE TABLE IF NOT EXISTS badges (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    trainer_id TEXT NOT NULL,
                    gym_type TEXT NOT NULL,
                    gym_name TEXT NOT NULL,
                    badge_image TEXT,
                    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    awarded_by TEXT,
                    FOREIGN KEY (trainer_id) REFERENCES trainers (id)
                );

                -- Gym leaders table
                CREATE TABLE IF NOT EXISTS gym_leaders (
                    id TEXT PRIMARY KEY,
                    guild_id TEXT NOT NULL,
                    gym_type TEXT NOT NULL,
                    username TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (guild_id) REFERENCES guilds (id)
                );

                -- Battle logs table
                CREATE TABLE IF NOT EXISTS battle_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    guild_id TEXT NOT NULL,
                    trainer_id TEXT NOT NULL,
                    gym_type TEXT NOT NULL,
                    result TEXT NOT NULL CHECK (result IN ('won', 'lost')),
                    gym_leader_id TEXT,
                    battle_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (guild_id) REFERENCES guilds (id),
                    FOREIGN KEY (trainer_id) REFERENCES trainers (id)
                );
            `;

            this.db.exec(createTablesSQL, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Database tables created successfully');
                    resolve();
                }
            });
        });
    }

    // Guild methods
    async addGuild(guildId, guildName) {
        return new Promise((resolve, reject) => {
            const sql = 'INSERT OR REPLACE INTO guilds (id, name) VALUES (?, ?)';
            this.db.run(sql, [guildId, guildName], function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    async updateGuildSetup(guildId, categoryId) {
        return new Promise((resolve, reject) => {
            const sql = 'UPDATE guilds SET category_id = ?, setup_completed = TRUE WHERE id = ?';
            this.db.run(sql, [categoryId, guildId], function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    async getGuild(guildId) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM guilds WHERE id = ?';
            this.db.get(sql, [guildId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    // Gym channel methods
    async addGymChannel(channelId, guildId, name, type, emoji) {
        return new Promise((resolve, reject) => {
            const sql = 'INSERT INTO gym_channels (id, guild_id, name, type, emoji) VALUES (?, ?, ?, ?, ?)';
            this.db.run(sql, [channelId, guildId, name, type, emoji], function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    async getGymChannels(guildId) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM gym_channels WHERE guild_id = ?';
            this.db.all(sql, [guildId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async updateChannelStatus(channelId, isOpen) {
        return new Promise((resolve, reject) => {
            const sql = 'UPDATE gym_channels SET is_open = ? WHERE id = ?';
            this.db.run(sql, [isOpen, channelId], function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    // Trainer methods
    async addTrainer(trainerId, guildId, username, displayName) {
        return new Promise((resolve, reject) => {
            const sql = 'INSERT OR REPLACE INTO trainers (id, guild_id, username, display_name) VALUES (?, ?, ?, ?)';
            this.db.run(sql, [trainerId, guildId, username, displayName], function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    async getTrainer(trainerId) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM trainers WHERE id = ?';
            this.db.get(sql, [trainerId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async getLeaderboard(guildId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT t.*, COUNT(b.id) as badge_count 
                FROM trainers t 
                LEFT JOIN badges b ON t.id = b.trainer_id 
                WHERE t.guild_id = ? 
                GROUP BY t.id 
                ORDER BY badge_count DESC, t.created_at ASC
            `;
            this.db.all(sql, [guildId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Badge methods
    async awardBadge(trainerId, gymType, gymName, badgeImage, awardedBy) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');
                
                // Add badge
                const badgeSQL = 'INSERT INTO badges (trainer_id, gym_type, gym_name, badge_image, awarded_by) VALUES (?, ?, ?, ?, ?)';
                this.db.run(badgeSQL, [trainerId, gymType, gymName, badgeImage, awardedBy], function(err) {
                    if (err) {
                        this.db.run('ROLLBACK');
                        reject(err);
                        return;
                    }
                    
                    // Update trainer badge count
                    const updateSQL = 'UPDATE trainers SET total_badges = total_badges + 1 WHERE id = ?';
                    this.db.run(updateSQL, [trainerId], function(err) {
                        if (err) {
                            this.db.run('ROLLBACK');
                            reject(err);
                        } else {
                            this.db.run('COMMIT');
                            resolve(this);
                        }
                    });
                });
            });
        });
    }

    async getTrainerBadges(trainerId) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM badges WHERE trainer_id = ? ORDER BY earned_at DESC';
            this.db.all(sql, [trainerId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Battle log methods
    async logBattle(guildId, trainerId, gymType, result, gymLeaderId) {
        return new Promise((resolve, reject) => {
            const sql = 'INSERT INTO battle_logs (guild_id, trainer_id, gym_type, result, gym_leader_id) VALUES (?, ?, ?, ?, ?)';
            this.db.run(sql, [guildId, trainerId, gymType, result, gymLeaderId], function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                } else {
                    console.log('Database connection closed');
                }
            });
        }
    }
}

module.exports = Database;