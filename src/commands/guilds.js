const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guilds')
        .setDescription('List all servers the bot is connected to (for testing web dropdown)'),
    
    async execute(interaction, db) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const client = interaction.client;
            const guilds = client.guilds.cache;

            if (guilds.size === 0) {
                return await interaction.editReply({
                    content: '❌ Bot is not connected to any servers!'
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🌐 Connected Servers')
                .setDescription(`The bot is connected to ${guilds.size} server(s):`)
                .setColor(0x3498db)
                .setTimestamp();

            let serverList = '';
            let totalMembers = 0;

            guilds.forEach((guild, index) => {
                if (index < 10) { // Show max 10 servers to avoid embed limits
                    serverList += `**${guild.name}**\n`;
                    serverList += `└ ID: \`${guild.id}\`\n`;
                    serverList += `└ Members: ${guild.memberCount}\n`;
                    serverList += `└ Owner: ${guild.ownerId}\n\n`;
                }
                totalMembers += guild.memberCount;
            });

            if (guilds.size > 10) {
                serverList += `*... and ${guilds.size - 10} more servers*`;
            }

            embed.addFields(
                {
                    name: '📋 Server List',
                    value: serverList || 'No servers found',
                    inline: false
                },
                {
                    name: '📊 Statistics',
                    value: `**Total Servers:** ${guilds.size}\n**Total Members:** ${totalMembers}`,
                    inline: true
                },
                {
                    name: '🌐 Web Interface',
                    value: `Visit [${process.env.WEB_URL || `http://localhost:${process.env.WEB_PORT || 3000}`}](${process.env.WEB_URL || `http://localhost:${process.env.WEB_PORT || 3000}`}) to see the server dropdown!`,
                    inline: false
                }
            );

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in guilds command:', error);
            await interaction.editReply({
                content: '❌ An error occurred while fetching server information.'
            });
        }
    }
};