const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Helper function to check if user is gym leader
function isGymLeader(member) {
    const gymLeaderRoles = process.env.GYM_LEADER_ROLES?.split(',') || [];
    return member.roles.cache.some(role => gymLeaderRoles.includes(role.id)) || 
           member.permissions.has('Administrator');
}

module.exports = [
    {
        data: new SlashCommandBuilder()
            .setName('opengym')
            .setDescription('Open the gym for battles'),
        
        async execute(interaction, db) {
            await interaction.deferReply();

            if (!isGymLeader(interaction.member)) {
                return await interaction.editReply({
                    content: '❌ Only Gym Leaders can manage gym status!'
                });
            }

            const channel = interaction.channel;
            
            try {
                // Update channel permissions to allow messages
                await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                    SendMessages: true,
                    ViewChannel: true,
                    ReadMessageHistory: true
                });

                // Update database
                await db.updateChannelStatus(channel.id, true);

                // Update channel topic
                const topic = channel.topic || '';
                const newTopic = topic.replace(/🔴.*?$/, '') + ' 🟢 Open for battles';
                await channel.setTopic(newTopic);

                const embed = new EmbedBuilder()
                    .setTitle('🟢 Gym Opened!')
                    .setDescription('The gym is now open for battles. Trainers may challenge the Gym Leader!')
                    .setColor(0x2ecc71)
                    .addFields(
                        { name: 'Status', value: '🟢 Open', inline: true },
                        { name: 'Opened by', value: interaction.user.toString(), inline: true }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Error opening gym:', error);
                await interaction.editReply({
                    content: '❌ An error occurred while opening the gym.'
                });
            }
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('closegym')
            .setDescription('Close the gym temporarily'),
        
        async execute(interaction, db) {
            await interaction.deferReply();

            if (!isGymLeader(interaction.member)) {
                return await interaction.editReply({
                    content: '❌ Only Gym Leaders can manage gym status!'
                });
            }

            const channel = interaction.channel;
            
            try {
                // Update channel permissions to deny messages from everyone except gym leaders
                await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                    SendMessages: false,
                    ViewChannel: true,
                    ReadMessageHistory: true
                });

                // Update database
                await db.updateChannelStatus(channel.id, false);

                // Update channel topic
                const topic = channel.topic || '';
                const newTopic = topic.replace(/🟢.*?$/, '') + ' 🔴 Temporarily closed';
                await channel.setTopic(newTopic);

                const embed = new EmbedBuilder()
                    .setTitle('🔴 Gym Closed!')
                    .setDescription('The gym is temporarily closed. Please check back later!')
                    .setColor(0xe74c3c)
                    .addFields(
                        { name: 'Status', value: '🔴 Closed', inline: true },
                        { name: 'Closed by', value: interaction.user.toString(), inline: true }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Error closing gym:', error);
                await interaction.editReply({
                    content: '❌ An error occurred while closing the gym.'
                });
            }
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('cleargym')
            .setDescription('Clear recent messages from the gym channel')
            .addIntegerOption(option =>
                option.setName('amount')
                    .setDescription('Number of messages to delete (1-100)')
                    .setRequired(false)
                    .setMinValue(1)
                    .setMaxValue(100)
            ),
        
        async execute(interaction, db) {
            await interaction.deferReply({ ephemeral: true });

            if (!isGymLeader(interaction.member)) {
                return await interaction.editReply({
                    content: '❌ Only Gym Leaders can clear gym channels!'
                });
            }

            const channel = interaction.channel;
            const amount = interaction.options.getInteger('amount') || 10;
            
            try {
                // Fetch messages to delete
                const messages = await channel.messages.fetch({ limit: amount });
                
                // Filter messages that are less than 14 days old (Discord limitation)
                const deletableMessages = messages.filter(msg => 
                    Date.now() - msg.createdTimestamp < 14 * 24 * 60 * 60 * 1000
                );

                if (deletableMessages.size === 0) {
                    return await interaction.editReply({
                        content: '❌ No messages found that can be deleted (messages must be less than 14 days old).'
                    });
                }

                // Delete messages
                await channel.bulkDelete(deletableMessages, true);

                await interaction.editReply({
                    content: `✅ Successfully deleted ${deletableMessages.size} messages from the gym channel.`
                });

                // Send a log message
                const embed = new EmbedBuilder()
                    .setTitle('🧹 Gym Cleaned')
                    .setDescription(`${deletableMessages.size} messages were cleared from this channel.`)
                    .setColor(0x3498db)
                    .addFields(
                        { name: 'Cleaned by', value: interaction.user.toString(), inline: true },
                        { name: 'Messages deleted', value: deletableMessages.size.toString(), inline: true }
                    )
                    .setTimestamp();

                setTimeout(async () => {
                    await channel.send({ embeds: [embed] });
                }, 1000);

            } catch (error) {
                console.error('Error clearing gym:', error);
                await interaction.editReply({
                    content: '❌ An error occurred while clearing the gym channel.'
                });
            }
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('gymstatus')
            .setDescription('Check the status of all gyms in the league'),
        
        async execute(interaction, db) {
            await interaction.deferReply();

            try {
                const gymChannels = await db.getGymChannels(interaction.guild.id);
                
                if (gymChannels.length === 0) {
                    return await interaction.editReply({
                        content: '❌ No gym channels found. Use `/setup` to create the gym league first!'
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle('🏆 Gym League Status')
                    .setDescription('Current status of all gyms in the league:')
                    .setColor(0x3498db)
                    .setTimestamp();

                let openGyms = 0;
                let closedGyms = 0;
                let statusText = '';

                for (const gym of gymChannels) {
                    const channel = interaction.guild.channels.cache.get(gym.id);
                    if (channel) {
                        const status = gym.is_open ? '🟢 Open' : '🔴 Closed';
                        statusText += `${gym.emoji} **${gym.name}**: ${status}\n`;
                        
                        if (gym.is_open) openGyms++;
                        else closedGyms++;
                    }
                }

                embed.addFields(
                    { name: 'Gym Status', value: statusText || 'No gyms found', inline: false },
                    { name: 'Summary', value: `🟢 Open: ${openGyms}\n🔴 Closed: ${closedGyms}`, inline: true }
                );

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Error checking gym status:', error);
                await interaction.editReply({
                    content: '❌ An error occurred while checking gym status.'
                });
            }
        }
    }
];