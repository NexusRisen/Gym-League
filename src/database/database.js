const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

/**
 * Enhanced Database Class with Automatic Schema Management
 * 
 * Features:
 * - Automatic table creation and column addition
 * - Automatic constraint and index management
 * - Safe table recreation for constraint changes
 * - Schema validation and reporting
 * - Multiple recovery options for foreign key constraint issues
 * 
 * Environment Variables:
 * - DB_PATH: Database file path (default: ./data/gym.db)
 * - DB_AUTO_RECREATE: Enable automatic table recreation for constraint changes (default: false)
 * - DB_AUTO_CLEANUP: Enable automatic removal of unused tables (default: false)
 * 
 * Quick Fix for Foreign Key Constraint Errors:
 * 
 * Option 1 - Environment Variable (Automatic):
 * Add to .env: DB_AUTO_RECREATE=true
 * 
 * Option 2 - Manual Fix (Preserves Data):
 * await db.quickFixConstraintIssues();
 * 
 * Option 3 - Command Line Utility:
 * node -e "require('./src/database/database.js').fixDatabaseIssues()"
 * 
 * Option 4 - Nuclear Option (Loses Data):
 * await db.recreateFromScratch();
 * 
 * Option 5 - Bot Startup Flag:
 * node index.js --fix-database
 * 
 * Schema Management:
 * 1. Modify the expectedSchema object to define your database structure
 * 2. Restart the bot - schema changes are applied automatically
 * 3. For constraint changes, use one of the fix options above
 * 
 * The system handles:
 * - Creating new tables and columns
 * - Adding missing indexes
 * - Updating column constraints (via table recreation)
 * - Preserving data during schema changes
 * - Foreign key constraint management
 * - Dependency resolution for table recreation order
 */
class Database {
    constructor() {
        this.dbPath = process.env.DB_PATH || './data/gym.db';
        this.db = null;
        
        // Define the complete expected database schema
        this.expectedSchema = {
            guilds: {
                columns: {
                    id: { type: 'TEXT', primaryKey: true, notNull: true },
                    name: { type: 'TEXT', notNull: true },
                    category_id: { type: 'TEXT' },
                    setup_completed: { type: 'BOOLEAN', default: 'FALSE' },
                    created_at: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' }
                },
                indexes: []
            },
            gym_channels: {
                columns: {
                    id: { type: 'TEXT', primaryKey: true, notNull: true },
                    guild_id: { type: 'TEXT', notNull: true },
                    name: { type: 'TEXT', notNull: true },
                    type: { type: 'TEXT', notNull: true },
                    emoji: { type: 'TEXT' },
                    is_open: { type: 'BOOLEAN', default: 'TRUE' },
                    created_at: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' }
                },
                foreignKeys: [
                    { column: 'guild_id', references: 'guilds(id)' }
                ],
                indexes: [
                    { name: 'idx_gym_channels_guild_id', columns: ['guild_id'] },
                    { name: 'idx_gym_channels_type', columns: ['type'] }
                ]
            },
            trainers: {
                columns: {
                    id: { type: 'TEXT', primaryKey: true, notNull: true },
                    guild_id: { type: 'TEXT', notNull: true },
                    username: { type: 'TEXT', notNull: true },
                    display_name: { type: 'TEXT' },
                    total_badges: { type: 'INTEGER', default: '0' },
                    created_at: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
                    updated_at: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' }
                },
                foreignKeys: [
                    { column: 'guild_id', references: 'guilds(id)' }
                ],
                indexes: [
                    { name: 'idx_trainers_guild_id', columns: ['guild_id'] },
                    { name: 'idx_trainers_total_badges', columns: ['total_badges'] }
                ]
            },
            badges: {
                columns: {
                    id: { type: 'INTEGER', primaryKey: true, autoIncrement: true },
                    trainer_id: { type: 'TEXT', notNull: true },
                    gym_type: { type: 'TEXT', notNull: true },
                    gym_name: { type: 'TEXT', notNull: true },
                    badge_image: { type: 'TEXT' },
                    earned_at: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
                    awarded_by: { type: 'TEXT' }
                },
                foreignKeys: [
                    { column: 'trainer_id', references: 'trainers(id)' }
                ],
                indexes: [
                    { name: 'idx_badges_trainer_id', columns: ['trainer_id'] },
                    { name: 'idx_badges_gym_type', columns: ['gym_type'] },
                    { name: 'idx_badges_earned_at', columns: ['earned_at'] }
                ]
            },
            battle_logs: {
                columns: {
                    id: { type: 'INTEGER', primaryKey: true, autoIncrement: true },
                    guild_id: { type: 'TEXT', notNull: true },
                    trainer_id: { type: 'TEXT', notNull: true },
                    gym_type: { type: 'TEXT', notNull: true },
                    result: { type: 'TEXT', notNull: true, check: "result IN ('won', 'lost')" },
                    gym_leader_id: { type: 'TEXT' },
                    battle_date: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' }
                },
                foreignKeys: [
                    { column: 'guild_id', references: 'guilds(id)' },
                    { column: 'trainer_id', references: 'trainers(id)' }
                ],
                indexes: [
                    { name: 'idx_battle_logs_guild_id', columns: ['guild_id'] },
                    { name: 'idx_battle_logs_trainer_id', columns: ['trainer_id'] },
                    { name: 'idx_battle_logs_battle_date', columns: ['battle_date'] }
                ]
            },
            gym_leaders: {
                columns: {
                    id: { type: 'INTEGER', primaryKey: true, autoIncrement: true },
                    user_id: { type: 'TEXT', notNull: true },
                    channel_id: { type: 'TEXT', notNull: true },
                    guild_id: { type: 'TEXT', notNull: true },
                    username: { type: 'TEXT', notNull: true },
                    display_name: { type: 'TEXT' },
                    added_by: { type: 'TEXT' },
                    created_at: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' }
                },
                foreignKeys: [
                    { column: 'guild_id', references: 'guilds(id)' },
                    { column: 'channel_id', references: 'gym_channels(id)' }
                ],
                uniqueConstraints: [
                    { name: 'unique_user_channel', columns: ['user_id', 'channel_id'] }
                ],
                indexes: [
                    { name: 'idx_gym_leaders_user_id', columns: ['user_id'] },
                    { name: 'idx_gym_leaders_channel_id', columns: ['channel_id'] },
                    { name: 'idx_gym_leaders_guild_id', columns: ['guild_id'] }
                ]
            }
        };
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
                    console.log('✅ Connected to SQLite database');
                    this.initializeSchema().then(() => {
                        console.log('🔧 Database schema initialized and updated');
                        resolve();
                    }).catch(reject);
                }
            });
        });
    }

    async initializeSchema() {
        try {
            // Enable foreign keys
            await this.runQuery('PRAGMA foreign_keys = ON');
            
            // Get current database schema
            const currentSchema = await this.getCurrentSchema();
            
            // Compare and update schema
            await this.updateSchema(currentSchema);
            
            console.log('✅ Schema management completed successfully');
        } catch (error) {
            console.error('❌ Schema management failed:', error.message);
            
            // Check if this is a foreign key constraint error
            if (error.message.includes('FOREIGN KEY constraint failed')) {
                console.log('\n🔧 Foreign key constraint error detected during schema update');
                console.log('💡 This typically happens when trying to recreate tables with foreign key relationships');
                console.log('\n🛠️  Available solutions:');
                console.log('   1. Run: await db.quickFixConstraintIssues() (preserves data)');
                console.log('   2. Set DB_AUTO_RECREATE=false and handle manually');
                console.log('   3. Use db.recreateFromScratch() (⚠️  loses data)');
                console.log('\n🔄 Attempting automatic recovery...');
                
                try {
                    await this.quickFixConstraintIssues();
                    console.log('✅ Automatic recovery successful!');
                } catch (recoveryError) {
                    console.error('❌ Automatic recovery failed:', recoveryError.message);
                    console.log('\n⚠️  Manual intervention required. Database may be in inconsistent state.');
                    throw new Error('Schema management failed and automatic recovery was unsuccessful. Manual intervention required.');
                }
            } else {
                throw error;
            }
        }
    }

    async getCurrentSchema() {
        const schema = {};
        
        // Get all tables
        const tables = await this.getAllQuery(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
        `);
        
        for (const table of tables) {
            const tableName = table.name;
            schema[tableName] = {
                columns: {},
                indexes: [],
                foreignKeys: [],
                uniqueConstraints: []
            };
            
            // Get column information
            const columns = await this.getAllQuery(`PRAGMA table_info(${tableName})`);
            for (const col of columns) {
                schema[tableName].columns[col.name] = {
                    type: col.type,
                    notNull: col.notnull === 1,
                    primaryKey: col.pk === 1,
                    default: col.dflt_value
                };
            }
            
            // Get foreign key information
            const foreignKeys = await this.getAllQuery(`PRAGMA foreign_key_list(${tableName})`);
            for (const fk of foreignKeys) {
                schema[tableName].foreignKeys.push({
                    column: fk.from,
                    references: `${fk.table}(${fk.to})`
                });
            }
            
            // Get index information
            const indices = await this.getAllQuery(`
                SELECT name FROM sqlite_master 
                WHERE type='index' AND tbl_name='${tableName}' AND name NOT LIKE 'sqlite_%'
            `);
            for (const index of indices) {
                const indexInfo = await this.getAllQuery(`PRAGMA index_info(${index.name})`);
                const columns = indexInfo.map(info => info.name);
                schema[tableName].indexes.push({
                    name: index.name,
                    columns: columns
                });
            }
        }
        
        return schema;
    }

    async updateSchema(currentSchema) {
        console.log('🔍 Analyzing database schema...');
        
        // Check if automatic recreation is enabled
        const autoRecreate = process.env.DB_AUTO_RECREATE === 'true';
        
        for (const [tableName, expectedTable] of Object.entries(this.expectedSchema)) {
            if (!currentSchema[tableName]) {
                // Table doesn't exist, create it
                console.log(`📝 Creating new table: ${tableName}`);
                await this.createTable(tableName, expectedTable);
            } else {
                // Table exists, check for column differences
                await this.updateTable(tableName, currentSchema[tableName], expectedTable);
            }
        }
        
        // Optionally remove tables that are no longer in the expected schema
        await this.cleanupUnusedTables(currentSchema);
        
        // If auto-recreate is enabled, handle constraint issues automatically
        if (autoRecreate) {
            console.log('🔄 DB_AUTO_RECREATE=true: Checking for tables needing constraint updates...');
            const tablesNeedingRecreation = [];
            
            for (const [tableName, expectedTable] of Object.entries(this.expectedSchema)) {
                if (currentSchema[tableName]) {
                    let needsRecreation = false;
                    for (const [columnName, expectedCol] of Object.entries(expectedTable.columns)) {
                        const currentCol = currentSchema[tableName].columns[columnName];
                        if (currentCol && this.requiresTableRecreation(currentCol, expectedCol)) {
                            needsRecreation = true;
                            break;
                        }
                    }
                    if (needsRecreation) {
                        tablesNeedingRecreation.push(tableName);
                    }
                }
            }
            
            if (tablesNeedingRecreation.length > 0) {
                console.log(`🔄 Auto-recreating ${tablesNeedingRecreation.length} tables with constraint changes...`);
                
                // Recreate tables in proper dependency order
                const recreationOrder = this.getTableRecreationOrder(tablesNeedingRecreation);
                console.log(`📋 Auto-recreation order: ${recreationOrder.join(' → ')}`);
                
                for (const tableName of recreationOrder) {
                    await this.recreateTableWithConstraints(tableName, this.expectedSchema[tableName]);
                }
            } else {
                console.log('✅ No tables need constraint recreation');
            }
        }
    }

    async createTable(tableName, tableSchema) {
        let sql = `CREATE TABLE ${tableName} (\n`;
        const columnDefs = [];
        
        // Add columns
        for (const [columnName, columnDef] of Object.entries(tableSchema.columns)) {
            let colSql = `  ${columnName} ${columnDef.type}`;
            
            if (columnDef.primaryKey) {
                colSql += ' PRIMARY KEY';
                if (columnDef.autoIncrement) {
                    colSql += ' AUTOINCREMENT';
                }
            }
            
            if (columnDef.notNull && !columnDef.primaryKey) {
                colSql += ' NOT NULL';
            }
            
            if (columnDef.default) {
                colSql += ` DEFAULT ${columnDef.default}`;
            }
            
            if (columnDef.check) {
                colSql += ` CHECK (${columnDef.check})`;
            }
            
            columnDefs.push(colSql);
        }
        
        // Add foreign keys
        if (tableSchema.foreignKeys) {
            for (const fk of tableSchema.foreignKeys) {
                columnDefs.push(`  FOREIGN KEY (${fk.column}) REFERENCES ${fk.references}`);
            }
        }
        
        // Add unique constraints
        if (tableSchema.uniqueConstraints) {
            for (const uc of tableSchema.uniqueConstraints) {
                columnDefs.push(`  UNIQUE(${uc.columns.join(', ')})`);
            }
        }
        
        sql += columnDefs.join(',\n') + '\n)';
        
        await this.runQuery(sql);
        console.log(`✅ Created table: ${tableName}`);
        
        // Create indexes
        if (tableSchema.indexes) {
            for (const index of tableSchema.indexes) {
                await this.createIndex(tableName, index);
            }
        }
    }

    async updateTable(tableName, currentTable, expectedTable) {
        console.log(`🔍 Checking table: ${tableName}`);
        let hasChanges = false;
        let needsRecreation = false;
        const columnChanges = [];
        
        // Check for missing columns and constraint changes
        for (const [columnName, columnDef] of Object.entries(expectedTable.columns)) {
            if (!currentTable.columns[columnName]) {
                console.log(`➕ Adding column ${columnName} to table ${tableName}`);
                if (!needsRecreation) {
                    await this.addColumn(tableName, columnName, columnDef);
                    hasChanges = true;
                }
            } else {
                // Column exists, check if definition matches
                const currentCol = currentTable.columns[columnName];
                if (this.columnDefinitionChanged(currentCol, columnDef)) {
                    console.log(`🔄 Column ${columnName} in table ${tableName} needs constraint updates`);
                    columnChanges.push({ name: columnName, current: currentCol, expected: columnDef });
                    
                    // Check if this requires table recreation
                    if (this.requiresTableRecreation(currentCol, columnDef)) {
                        needsRecreation = true;
                        console.log(`🔄 Table ${tableName} requires recreation due to constraint changes`);
                    }
                }
            }
        }
        
        // If table recreation is needed, do it
        if (needsRecreation) {
            console.log(`🔄 Recreating table ${tableName} with updated constraints...`);
            await this.recreateTableWithConstraints(tableName, expectedTable);
            hasChanges = true;
        }
        
        // Check for missing indexes (only if table wasn't recreated)
        if (!needsRecreation && expectedTable.indexes) {
            for (const expectedIndex of expectedTable.indexes) {
                const existingIndex = currentTable.indexes.find(idx => idx.name === expectedIndex.name);
                if (!existingIndex) {
                    console.log(`➕ Creating index ${expectedIndex.name} on table ${tableName}`);
                    await this.createIndex(tableName, expectedIndex);
                    hasChanges = true;
                }
            }
        }
        
        if (!hasChanges) {
            console.log(`✅ Table ${tableName} is up to date`);
        } else if (columnChanges.length > 0 && !needsRecreation) {
            console.log(`⚠️  Some constraint changes for ${tableName} could not be applied automatically:`);
            columnChanges.forEach(change => {
                console.log(`   - ${change.name}: ${JSON.stringify(change.current)} → ${JSON.stringify(change.expected)}`);
            });
        }
    }

    async addColumn(tableName, columnName, columnDef) {
        let sql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef.type}`;
        
        if (columnDef.notNull && columnDef.default) {
            sql += ` NOT NULL DEFAULT ${columnDef.default}`;
        } else if (columnDef.default) {
            sql += ` DEFAULT ${columnDef.default}`;
        }
        
        await this.runQuery(sql);
        console.log(`✅ Added column ${columnName} to table ${tableName}`);
    }

    async createIndex(tableName, indexDef) {
        const sql = `CREATE INDEX IF NOT EXISTS ${indexDef.name} ON ${tableName} (${indexDef.columns.join(', ')})`;
        await this.runQuery(sql);
        console.log(`✅ Created index ${indexDef.name} on table ${tableName}`);
    }

    async cleanupUnusedTables(currentSchema) {
        const unusedTables = Object.keys(currentSchema).filter(
            tableName => !this.expectedSchema[tableName]
        );
        
        if (unusedTables.length > 0) {
            console.log(`⚠️  Found unused tables: ${unusedTables.join(', ')}`);
            
            // Check if automatic cleanup is enabled
            if (process.env.DB_AUTO_CLEANUP === 'true') {
                console.log('🗑️  DB_AUTO_CLEANUP=true: Removing unused tables...');
                for (const tableName of unusedTables) {
                    await this.runQuery(`DROP TABLE IF EXISTS ${tableName}`);
                    console.log(`🗑️  Removed unused table: ${tableName}`);
                }
            } else {
                console.log(`   These tables are not automatically removed for safety.`);
                console.log(`   To enable automatic cleanup, set DB_AUTO_CLEANUP=true`);
                console.log(`   Or remove them manually if no longer needed.`);
            }
        }
    }

    columnDefinitionChanged(current, expected) {
        // Normalize types for comparison
        const normalizeType = (type) => {
            if (!type) return '';
            return type.toUpperCase().trim();
        };
        
        if (normalizeType(current.type) !== normalizeType(expected.type)) {
            return true;
        }
        
        if (current.notNull !== (expected.notNull || false)) {
            return true;
        }
        
        if (current.primaryKey !== (expected.primaryKey || false)) {
            return true;
        }
        
        // Default value comparison (basic)
        const currentDefault = current.default === null ? undefined : current.default;
        const expectedDefault = expected.default;
        
        if (currentDefault !== expectedDefault) {
            return true;
        }
        
        return false;
    }

    requiresTableRecreation(currentCol, expectedCol) {
        // Check if changes require table recreation (can't be done with ALTER TABLE in SQLite)
        
        // Primary key changes
        if (currentCol.primaryKey !== (expectedCol.primaryKey || false)) {
            return true;
        }
        
        // NOT NULL constraint changes on existing data
        if (!currentCol.notNull && expectedCol.notNull) {
            return true;
        }
        
        // Type changes (though we're being conservative here)
        const normalizeType = (type) => {
            if (!type) return '';
            return type.toUpperCase().trim();
        };
        
        if (normalizeType(currentCol.type) !== normalizeType(expectedCol.type)) {
            return true;
        }
        
        // Check constraints or other complex changes
        if (expectedCol.check && !currentCol.check) {
            return true;
        }
        
        return false;
    }

    async recreateTableWithConstraints(tableName, expectedTable) {
        const tempTableName = `${tableName}_temp_${Date.now()}`;
        
        try {
            console.log(`📝 Creating temporary table: ${tempTableName}`);
            
            // Temporarily disable foreign key constraints for this operation
            await this.runQuery('PRAGMA foreign_keys = OFF');
            
            // Create the new table with correct schema
            await this.createTable(tempTableName, expectedTable);
            
            // Get current data from old table
            console.log(`📋 Copying data from ${tableName} to ${tempTableName}`);
            const oldData = await this.getAllQuery(`SELECT * FROM ${tableName}`);
            
            if (oldData.length > 0) {
                // Prepare column mapping
                const oldColumns = Object.keys(oldData[0]);
                const newColumns = Object.keys(expectedTable.columns);
                const commonColumns = oldColumns.filter(col => newColumns.includes(col));
                
                if (commonColumns.length > 0) {
                    // Insert data in batches to avoid memory issues
                    const batchSize = 1000;
                    for (let i = 0; i < oldData.length; i += batchSize) {
                        const batch = oldData.slice(i, i + batchSize);
                        await this.insertBatch(tempTableName, commonColumns, batch);
                    }
                    console.log(`✅ Copied ${oldData.length} rows to new table`);
                } else {
                    console.log(`⚠️  No common columns found, creating empty table`);
                }
            } else {
                console.log(`📋 Original table was empty, no data to copy`);
            }
            
            // Drop old table and rename new one (foreign keys are disabled)
            await this.runQuery(`DROP TABLE ${tableName}`);
            await this.runQuery(`ALTER TABLE ${tempTableName} RENAME TO ${tableName}`);
            
            // Re-enable foreign key constraints
            await this.runQuery('PRAGMA foreign_keys = ON');
            
            console.log(`✅ Successfully recreated table ${tableName} with updated constraints`);
            
        } catch (error) {
            console.error(`❌ Error recreating table ${tableName}:`, error);
            
            // Ensure foreign keys are re-enabled even on error
            try {
                await this.runQuery('PRAGMA foreign_keys = ON');
            } catch (fkError) {
                console.error('Error re-enabling foreign keys:', fkError.message);
            }
            
            // Cleanup: try to remove temp table if it exists
            try {
                await this.runQuery(`DROP TABLE IF EXISTS ${tempTableName}`);
            } catch (cleanupError) {
                console.error('Cleanup error:', cleanupError.message);
            }
            
            throw error;
        }
    }

    async insertBatch(tableName, columns, dataRows) {
        const placeholders = columns.map(() => '?').join(', ');
        const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
        
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');
                
                let completed = 0;
                let hasError = false;
                
                const handleCompletion = (err) => {
                    if (err && !hasError) {
                        hasError = true;
                        this.db.run('ROLLBACK');
                        reject(err);
                        return;
                    }
                    
                    completed++;
                    if (completed === dataRows.length && !hasError) {
                        this.db.run('COMMIT', (commitErr) => {
                            if (commitErr) {
                                reject(commitErr);
                            } else {
                                resolve();
                            }
                        });
                    }
                };
                
                dataRows.forEach(row => {
                    const values = columns.map(col => row[col]);
                    this.db.run(sql, values, handleCompletion);
                });
            });
        });
    }

    // Helper methods for database operations
    async runQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('SQL Error:', err.message);
                    console.error('Query:', sql);
                    reject(err);
                } else {
                    resolve(this);
                }
            });
        });
    }

    async getQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    console.error('SQL Error:', err.message);
                    console.error('Query:', sql);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getAllQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('SQL Error:', err.message);
                    console.error('Query:', sql);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Legacy method for backward compatibility - now uses the new schema system
    async createTables() {
        console.log('📝 Using new schema management system...');
        // This method is now handled by initializeSchema()
        return Promise.resolve();
    }

    // Legacy method for backward compatibility
    async checkAndUpdateSchema() {
        console.log('🔧 Schema check handled by new system...');
        // This is now handled by initializeSchema()
        return Promise.resolve();
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

    // Gym leader methods
    async addGymLeader(userId, channelId, guildId, username, displayName, addedBy) {
        return new Promise((resolve, reject) => {
            const sql = 'INSERT OR REPLACE INTO gym_leaders (user_id, channel_id, guild_id, username, display_name, added_by) VALUES (?, ?, ?, ?, ?, ?)';
            this.db.run(sql, [userId, channelId, guildId, username, displayName, addedBy], function(err) {
                if (err) {
                    console.error('Error adding gym leader:', err);
                    reject(err);
                } else {
                    console.log(`✅ Added gym leader: ${username} to channel ${channelId}`);
                    resolve(this);
                }
            });
        });
    }

    async removeGymLeader(userId, channelId) {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM gym_leaders WHERE user_id = ? AND channel_id = ?';
            this.db.run(sql, [userId, channelId], function(err) {
                if (err) reject(err);
                else resolve(this.changes > 0);
            });
        });
    }

    async isGymLeader(userId, channelId) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT COUNT(*) as count FROM gym_leaders WHERE user_id = ? AND channel_id = ?';
            this.db.get(sql, [userId, channelId], (err, row) => {
                if (err) reject(err);
                else resolve(row.count > 0);
            });
        });
    }

    async getChannelGymLeaders(channelId) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM gym_leaders WHERE channel_id = ?';
            this.db.all(sql, [channelId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async getGymLeaderChannels(userId, guildId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT gl.*, gc.name as channel_name, gc.type as gym_type, gc.emoji
                FROM gym_leaders gl 
                JOIN gym_channels gc ON gl.channel_id = gc.id 
                WHERE gl.user_id = ? AND gl.guild_id = ?
            `;
            this.db.all(sql, [userId, guildId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Trainer methods
    async addTrainer(trainerId, guildId, username, displayName) {
        return new Promise((resolve, reject) => {
            const sql = 'INSERT OR REPLACE INTO trainers (id, guild_id, username, display_name, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)';
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
                    const updateSQL = 'UPDATE trainers SET total_badges = total_badges + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
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

    // Utility methods for advanced schema management
    async addNewTable(tableName, tableDefinition) {
        console.log(`➕ Adding new table to schema: ${tableName}`);
        this.expectedSchema[tableName] = tableDefinition;
        await this.createTable(tableName, tableDefinition);
        console.log(`✅ Successfully added table: ${tableName}`);
    }

    async addNewColumn(tableName, columnName, columnDefinition) {
        console.log(`➕ Adding new column to schema: ${tableName}.${columnName}`);
        if (!this.expectedSchema[tableName]) {
            throw new Error(`Table ${tableName} not found in expected schema`);
        }
        
        this.expectedSchema[tableName].columns[columnName] = columnDefinition;
        await this.addColumn(tableName, columnName, columnDefinition);
        console.log(`✅ Successfully added column: ${tableName}.${columnName}`);
    }

    async forceRecreateTable(tableName) {
        console.log(`🔄 Force recreating table: ${tableName}`);
        
        if (!this.expectedSchema[tableName]) {
            throw new Error(`Table ${tableName} not found in expected schema`);
        }
        
        await this.recreateTableWithConstraints(tableName, this.expectedSchema[tableName]);
        console.log(`✅ Force recreation completed for table: ${tableName}`);
    }

    async forceRecreateAllTables() {
        console.log(`🔄 Force recreating ALL tables with current schema...`);
        
        // Get list of tables that need recreation (those with constraint issues)
        const currentSchema = await this.getCurrentSchema();
        const tablesToRecreate = [];
        
        for (const [tableName, expectedTable] of Object.entries(this.expectedSchema)) {
            if (currentSchema[tableName]) {
                // Check if any columns need constraint changes
                let needsRecreation = false;
                for (const [columnName, expectedCol] of Object.entries(expectedTable.columns)) {
                    const currentCol = currentSchema[tableName].columns[columnName];
                    if (currentCol && this.requiresTableRecreation(currentCol, expectedCol)) {
                        needsRecreation = true;
                        break;
                    }
                }
                if (needsRecreation) {
                    tablesToRecreate.push(tableName);
                }
            }
        }
        
        if (tablesToRecreate.length === 0) {
            console.log(`✅ No tables require recreation`);
            return;
        }
        
        console.log(`🔄 Tables requiring recreation: ${tablesToRecreate.join(', ')}`);
        
        // Recreate tables in dependency order (tables with foreign keys first)
        const recreationOrder = this.getTableRecreationOrder(tablesToRecreate);
        console.log(`📋 Recreation order: ${recreationOrder.join(' → ')}`);
        
        for (const tableName of recreationOrder) {
            await this.forceRecreateTable(tableName);
        }
        
        console.log(`✅ Force recreation completed for ${tablesToRecreate.length} tables`);
    }

    getTableRecreationOrder(tableNames) {
        // Simple dependency resolution based on foreign keys
        // Tables with no foreign keys can be recreated first
        // Tables with foreign keys should be recreated after their dependencies
        
        const dependencies = new Map();
        const noDependencies = [];
        
        for (const tableName of tableNames) {
            const tableSchema = this.expectedSchema[tableName];
            if (tableSchema.foreignKeys && tableSchema.foreignKeys.length > 0) {
                const deps = tableSchema.foreignKeys.map(fk => {
                    // Extract referenced table name from "table(column)" format
                    return fk.references.split('(')[0];
                }).filter(depTable => tableNames.includes(depTable));
                
                if (deps.length > 0) {
                    dependencies.set(tableName, deps);
                } else {
                    noDependencies.push(tableName);
                }
            } else {
                noDependencies.push(tableName);
            }
        }
        
        // Simple topological sort
        const result = [...noDependencies];
        const remaining = new Set(dependencies.keys());
        
        while (remaining.size > 0) {
            let progress = false;
            for (const tableName of remaining) {
                const deps = dependencies.get(tableName);
                const allDepsResolved = deps.every(dep => 
                    result.includes(dep) || !tableNames.includes(dep)
                );
                
                if (allDepsResolved) {
                    result.push(tableName);
                    remaining.delete(tableName);
                    progress = true;
                }
            }
            
            if (!progress) {
                // Circular dependency or other issue, just add remaining tables
                console.log('⚠️  Circular dependency detected, adding remaining tables');
                result.push(...remaining);
                break;
            }
        }
        
        return result;
    }

    async validateSchema() {
        console.log('🔍 Validating current database schema...');
        const currentSchema = await this.getCurrentSchema();
        const issues = [];
        
        for (const [tableName, expectedTable] of Object.entries(this.expectedSchema)) {
            if (!currentSchema[tableName]) {
                issues.push(`Missing table: ${tableName}`);
                continue;
            }
            
            for (const [columnName, expectedColumn] of Object.entries(expectedTable.columns)) {
                if (!currentSchema[tableName].columns[columnName]) {
                    issues.push(`Missing column: ${tableName}.${columnName}`);
                } else {
                    const currentCol = currentSchema[tableName].columns[columnName];
                    if (this.columnDefinitionChanged(currentCol, expectedColumn)) {
                        issues.push(`Column constraint mismatch: ${tableName}.${columnName}`);
                    }
                }
            }
            
            // Check for missing indexes
            if (expectedTable.indexes) {
                for (const expectedIndex of expectedTable.indexes) {
                    const existingIndex = currentSchema[tableName].indexes.find(idx => idx.name === expectedIndex.name);
                    if (!existingIndex) {
                        issues.push(`Missing index: ${expectedIndex.name} on table ${tableName}`);
                    }
                }
            }
        }
        
        if (issues.length === 0) {
            console.log('✅ Database schema is valid');
        } else {
            console.log('⚠️  Schema validation issues found:');
            issues.forEach(issue => console.log(`   - ${issue}`));
            console.log(`\n💡 To fix constraint issues automatically, you can:`);
            console.log(`   - Set DB_AUTO_RECREATE=true environment variable`);
            console.log(`   - Or call db.forceRecreateAllTables() manually`);
        }
        
        return issues;
    }

    async safeSchemaRecreation() {
        console.log('🔄 Performing safe schema recreation with new database file...');
        
        const backupPath = this.dbPath + '.backup.' + Date.now();
        const newDbPath = this.dbPath + '.new.' + Date.now();
        
        try {
            // Create backup of current database
            console.log(`💾 Creating backup: ${backupPath}`);
            fs.copyFileSync(this.dbPath, backupPath);
            
            // Create new database with correct schema
            console.log(`📝 Creating new database with correct schema: ${newDbPath}`);
            const newDb = new sqlite3.Database(newDbPath);
            
            // Create all tables with correct schema in new database
            await this.createTablesInDatabase(newDb);
            
            // Migrate data from old to new database
            console.log('📋 Migrating data from old to new database...');
            await this.migrateDataBetweenDatabases(this.db, newDb);
            
            // Close databases
            await this.closeDatabaseConnection(newDb);
            this.close();
            
            // Replace old database with new one
            console.log('🔄 Replacing old database with new one...');
            fs.renameSync(newDbPath, this.dbPath);
            
            // Reconnect to the new database
            await this.initialize();
            
            console.log(`✅ Safe schema recreation completed successfully`);
            console.log(`💾 Backup available at: ${backupPath}`);
            
        } catch (error) {
            console.error('❌ Error during safe schema recreation:', error);
            
            // Cleanup
            try {
                if (fs.existsSync(newDbPath)) {
                    fs.unlinkSync(newDbPath);
                }
            } catch (cleanupError) {
                console.error('Cleanup error:', cleanupError.message);
            }
            
            throw error;
        }
    }

    async createTablesInDatabase(database) {
        return new Promise((resolve, reject) => {
            database.serialize(async () => {
                try {
                    // Enable foreign keys
                    database.run('PRAGMA foreign_keys = ON');
                    
                    // Create all tables
                    for (const [tableName, tableSchema] of Object.entries(this.expectedSchema)) {
                        const sql = this.generateCreateTableSQL(tableName, tableSchema);
                        await this.runQueryOnDatabase(database, sql);
                        
                        // Create indexes
                        if (tableSchema.indexes) {
                            for (const index of tableSchema.indexes) {
                                const indexSQL = `CREATE INDEX IF NOT EXISTS ${index.name} ON ${tableName} (${index.columns.join(', ')})`;
                                await this.runQueryOnDatabase(database, indexSQL);
                            }
                        }
                    }
                    
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    async migrateDataBetweenDatabases(sourceDb, targetDb) {
        // Get list of tables in source database
        const tables = await this.getAllQuery('SELECT name FROM sqlite_master WHERE type="table" AND name NOT LIKE "sqlite_%"');
        
        for (const table of tables) {
            const tableName = table.name;
            
            if (this.expectedSchema[tableName]) {
                console.log(`📋 Migrating data for table: ${tableName}`);
                
                // Get data from source
                const data = await this.getAllQuery(`SELECT * FROM ${tableName}`);
                
                if (data.length > 0) {
                    // Get common columns between old and new schema
                    const oldColumns = Object.keys(data[0]);
                    const newColumns = Object.keys(this.expectedSchema[tableName].columns);
                    const commonColumns = oldColumns.filter(col => newColumns.includes(col));
                    
                    if (commonColumns.length > 0) {
                        // Insert data into target database
                        const placeholders = commonColumns.map(() => '?').join(', ');
                        const insertSQL = `INSERT INTO ${tableName} (${commonColumns.join(', ')}) VALUES (${placeholders})`;
                        
                        for (const row of data) {
                            const values = commonColumns.map(col => row[col]);
                            await this.runQueryOnDatabase(targetDb, insertSQL, values);
                        }
                        
                        console.log(`✅ Migrated ${data.length} rows for ${tableName}`);
                    }
                }
            }
        }
    }

    async runQueryOnDatabase(database, sql, params = []) {
        return new Promise((resolve, reject) => {
            database.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this);
                }
            });
        });
    }

    async closeDatabaseConnection(database) {
        return new Promise((resolve, reject) => {
            database.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    generateCreateTableSQL(tableName, tableSchema) {
        let sql = `CREATE TABLE ${tableName} (\n`;
        const columnDefs = [];
        
        // Add columns
        for (const [columnName, columnDef] of Object.entries(tableSchema.columns)) {
            let colSql = `  ${columnName} ${columnDef.type}`;
            
            if (columnDef.primaryKey) {
                colSql += ' PRIMARY KEY';
                if (columnDef.autoIncrement) {
                    colSql += ' AUTOINCREMENT';
                }
            }
            
            if (columnDef.notNull && !columnDef.primaryKey) {
                colSql += ' NOT NULL';
            }
            
            if (columnDef.default) {
                colSql += ` DEFAULT ${columnDef.default}`;
            }
            
            if (columnDef.check) {
                colSql += ` CHECK (${columnDef.check})`;
            }
            
            columnDefs.push(colSql);
        }
        
        // Add foreign keys
        if (tableSchema.foreignKeys) {
            for (const fk of tableSchema.foreignKeys) {
                columnDefs.push(`  FOREIGN KEY (${fk.column}) REFERENCES ${fk.references}`);
            }
        }
        
        // Add unique constraints
        if (tableSchema.uniqueConstraints) {
            for (const uc of tableSchema.uniqueConstraints) {
                columnDefs.push(`  UNIQUE(${uc.columns.join(', ')})`);
            }
        }
        
        sql += columnDefs.join(',\n') + '\n)';
        return sql;
    }

    async getSchemaInfo() {
        const currentSchema = await this.getCurrentSchema();
        const info = {
            tables: Object.keys(currentSchema).length,
            expectedTables: Object.keys(this.expectedSchema).length,
            issues: [],
            recreationNeeded: []
        };
        
        for (const [tableName, expectedTable] of Object.entries(this.expectedSchema)) {
            if (!currentSchema[tableName]) {
                info.issues.push(`Missing table: ${tableName}`);
            } else {
                let needsRecreation = false;
                for (const [columnName, expectedCol] of Object.entries(expectedTable.columns)) {
                    const currentCol = currentSchema[tableName].columns[columnName];
                    if (currentCol && this.requiresTableRecreation(currentCol, expectedCol)) {
                        needsRecreation = true;
                        break;
                    }
                }
                if (needsRecreation) {
                    info.recreationNeeded.push(tableName);
                }
            }
        }
        
        return info;
    }

    /**
     * Quick fix method for foreign key constraint issues during table recreation
     * This is a safe fallback when the normal recreation process fails due to FK constraints
     */
    async quickFixConstraintIssues() {
        console.log('🔧 Attempting quick fix for foreign key constraint issues...');
        
        try {
            // First, try to identify which tables have the constraint issues
            const schemaInfo = await this.getSchemaInfo();
            
            if (schemaInfo.recreationNeeded.length === 0) {
                console.log('✅ No constraint issues detected');
                return;
            }
            
            console.log(`🔧 Found ${schemaInfo.recreationNeeded.length} tables with constraint issues`);
            console.log(`   Tables: ${schemaInfo.recreationNeeded.join(', ')}`);
            
            // Try the safe schema recreation method
            console.log('🔄 Attempting safe schema recreation...');
            await this.safeSchemaRecreation();
            
        } catch (error) {
            console.error('❌ Quick fix failed:', error.message);
            console.log('\n💡 Manual fix options:');
            console.log('   1. Backup your database file');
            console.log('   2. Delete the database file to start fresh');
            console.log('   3. Or run: node -e "require(\'./src/database/database.js\').prototype.recreateFromScratch()"');
            throw error;
        }
    }

    /**
     * Nuclear option: completely recreate database from scratch
     * Only use this if you're okay with losing existing data
     */
    async recreateFromScratch() {
        console.log('💥 NUCLEAR OPTION: Recreating database from scratch...');
        console.log('⚠️  This will DELETE ALL existing data!');
        
        // Create backup first
        const backupPath = this.dbPath + '.backup.' + Date.now();
        if (fs.existsSync(this.dbPath)) {
            console.log(`💾 Creating backup: ${backupPath}`);
            fs.copyFileSync(this.dbPath, backupPath);
        }
        
        // Close current connection
        if (this.db) {
            this.close();
        }
        
        // Delete existing database
        if (fs.existsSync(this.dbPath)) {
            fs.unlinkSync(this.dbPath);
            console.log('🗑️  Deleted old database file');
        }
        
        // Reinitialize with clean schema
        await this.initialize();
        console.log('✅ Fresh database created with correct schema');
        console.log(`💾 Backup of old database: ${backupPath}`);
    }

    /**
     * Simple method to fix common database issues
     * Can be called easily from bot startup or maintenance scripts
     */
    static async fixDatabaseIssues(dbPath) {
        console.log('🔧 Running database issue fix utility...');
        
        const tempDb = new Database();
        if (dbPath) {
            tempDb.dbPath = dbPath;
        }
        
        try {
            await tempDb.initialize();
            const issues = await tempDb.validateSchema();
            
            if (issues.length === 0) {
                console.log('✅ No database issues found');
                return;
            }
            
            console.log(`🔧 Found ${issues.length} database issues`);
            
            // Try to fix automatically
            await tempDb.quickFixConstraintIssues();
            
            console.log('✅ Database issues resolved successfully');
            
        } catch (error) {
            console.error('❌ Failed to fix database issues:', error.message);
            throw error;
        } finally {
            if (tempDb.db) {
                tempDb.close();
            }
        }
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