const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

async function loadCommands(client) {
    const commands = [];
    const commandsPath = path.join(__dirname, '../commands');
    
    // Read all command files
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        // Handle both single commands and arrays of commands
        if (Array.isArray(command)) {
            for (const cmd of command) {
                if ('data' in cmd && 'execute' in cmd) {
                    client.commands.set(cmd.data.name, cmd);
                    commands.push(cmd.data.toJSON());
                    console.log(`✅ Loaded command: ${cmd.data.name}`);
                } else {
                    console.log(`❌ Command ${file} is missing required properties`);
                }
            }
        } else {
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                commands.push(command.data.toJSON());
                console.log(`✅ Loaded command: ${command.data.name}`);
            } else {
                console.log(`❌ Command ${file} is missing required properties`);
            }
        }
    }
    
    // Register commands with Discord
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);
    
    try {
        console.log('🔄 Started refreshing application (/) commands...');
        
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        
        console.log('✅ Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
}

module.exports = { loadCommands };