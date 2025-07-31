const fs = require('fs');
const path = require('path');

async function loadEvents(client, database) {
    const eventsPath = path.join(__dirname, '../events');
    
    if (!fs.existsSync(eventsPath)) {
        fs.mkdirSync(eventsPath, { recursive: true });
    }
    
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, database));
        } else {
            client.on(event.name, (...args) => event.execute(...args, database));
        }
        
        console.log(`✅ Loaded event: ${event.name}`);
    }
    
    // Load built-in events if no event files exist
    if (eventFiles.length === 0) {
        // Ready event
        client.once('ready', () => {
            console.log(`🚀 ${client.user.tag} is online and ready!`);
            console.log(`📊 Serving ${client.guilds.cache.size} servers`);
            console.log(`👥 Watching ${client.users.cache.size} users`);
        });
        
        // Interaction event
        client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            
            const command = client.commands.get(interaction.commandName);
            
            if (!command) {
                console.error(`❌ No command matching ${interaction.commandName} was found.`);
                return;
            }
            
            try {
                await command.execute(interaction, database);
            } catch (error) {
                console.error('❌ Error executing command:', error);
                const errorMessage = {
                    content: '❌ There was an error executing this command!',
                    ephemeral: true
                };
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            }
        });
        
        console.log('✅ Loaded built-in events');
    }
}

module.exports = { loadEvents };