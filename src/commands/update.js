const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const gymConfig = require('../config/gymConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('update')
        .setDescription('Update all gym channel embeds with fresh badge images and information')
        .addBooleanOption(option =>
            option.setName('force')
                .setDescription('Force update even if channels seem up to date')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction, db) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guild = interaction.guild;
        const forceUpdate = interaction.options.getBoolean('force') || false;

        try {
            // Check if guild is set up
            const guildData = await db.getGuild(guild.id);
            if (!guildData || !guildData.setup_completed) {
                return await interaction.editReply({
                    content: '❌ Gym league is not set up yet! Use `/setup` first.'
                });
            }

            // Get all gym channels from database
            const gymChannels = await db.getGymChannels(guild.id);
            if (gymChannels.length === 0) {
                return await interaction.editReply({
                    content: '❌ No gym channels found! Use `/setup` to create them first.'
                });
            }

            let updatedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;
            const updateLog = [];

            await interaction.editReply({
                content: `🔄 Starting to update ${gymChannels.length} gym channels...`
            });

            // Update each gym channel
            for (const gymChannel of gymChannels) {
                try {
                    const channel = guild.channels.cache.get(gymChannel.id);
                    if (!channel) {
                        updateLog.push(`❌ Channel not found: ${gymChannel.name}`);
                        errorCount++;
                        continue;
                    }

                    // Find gym config
                    let gymInfo = null;
                    if (gymChannel.type === 'champion') {
                        gymInfo = gymConfig.champion;
                    } else if (gymChannel.type.includes('elite')) {
                        gymInfo = gymConfig.eliteFour.find(e => e.type === gymChannel.type);
                    } else {
                        gymInfo = gymConfig.gyms.find(g => g.type === gymChannel.type);
                    }

                    if (!gymInfo) {
                        updateLog.push(`❌ Config not found for: ${gymChannel.name}`);
                        errorCount++;
                        continue;
                    }

                    // Check if channel needs updating (look for bot messages)
                    const messages = await channel.messages.fetch({ limit: 10 });
                    const botMessages = messages.filter(msg => msg.author.id === interaction.client.user.id);
                    
                    // Update or create the welcome embed
                    const embed = new EmbedBuilder()
                        .setColor(parseInt(gymInfo.color.replace('#', ''), 16))
                        .setTimestamp();

                    if (gymChannel.type === 'champion') {
                        embed
                            .setTitle(`${gymInfo.emoji} Welcome to ${gymInfo.name}!`)
                            .setDescription(gymInfo.description)
                            .addFields(
                                {
                                    name: 'Champion Challenge',
                                    value: 'The ultimate test for Pokemon trainers!',
                                    inline: false
                                },
                                {
                                    name: 'Requirements',
                                    value: '• Defeat all 8 Gym Leaders\n• Defeat all Elite Four members\n• Prove you are worthy of the title',
                                    inline: false
                                },
                                {
                                    name: 'Championship Status',
                                    value: '👑 Ready for challengers',
                                    inline: true
                                }
                            )
                            .setThumbnail(gymInfo.badgeImage)
                            .setImage(gymInfo.badgeImage); // Use as main image too
                    } else if (gymChannel.type.includes('elite')) {
                        embed
                            .setTitle(`${gymInfo.emoji} ${gymInfo.name}`)
                            .setDescription(gymInfo.description)
                            .addFields(
                                {
                                    name: 'Elite Challenge',
                                    value: 'Only the strongest trainers may challenge the Elite Four!',
                                    inline: false
                                },
                                {
                                    name: 'Requirements',
                                    value: 'You must have earned at least 8 gym badges to challenge the Elite Four.',
                                    inline: false
                                },
                                {
                                    name: 'Elite Status',
                                    value: '⭐ Ready for elite battles',
                                    inline: true
                                }
                            )
                            .setThumbnail(gymInfo.badgeImage)
                            .setImage(gymInfo.badgeImage);
                    } else {
                        embed
                            .setTitle(`${gymInfo.emoji} Welcome to ${gymInfo.name}!`)
                            .setDescription(gymInfo.description)
                            .addFields(
                                {
                                    name: 'How to Battle',
                                    value: 'Challenge the Gym Leader and prove your worth to earn the badge!',
                                    inline: false
                                },
                                {
                                    name: 'Type Specialty',
                                    value: `${gymInfo.type.charAt(0).toUpperCase() + gymInfo.type.slice(1)}-type Pokemon`,
                                    inline: true
                                },
                                {
                                    name: 'Gym Status',
                                    value: gymChannel.is_open ? '🟢 Open for battles' : '🔴 Currently closed',
                                    inline: true
                                }
                            )
                            .setThumbnail(gymInfo.badgeImage)
                            .setImage(gymInfo.badgeImage);
                    }

                    // Clear old bot messages if force update
                    if (forceUpdate && botMessages.size > 0) {
                        for (const [, message] of botMessages) {
                            try {
                                await message.delete();
                            } catch (deleteError) {
                                // Ignore delete errors (message might be too old)
                            }
                        }
                    }

                    // Send new embed
                    await channel.send({ embeds: [embed] });
                    
                    updateLog.push(`✅ Updated: ${gymInfo.emoji} ${gymChannel.name}`);
                    updatedCount++;

                } catch (channelError) {
                    console.error(`Error updating channel ${gymChannel.name}:`, channelError);
                    updateLog.push(`❌ Error updating: ${gymChannel.name} - ${channelError.message}`);
                    errorCount++;
                }

                // Add small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Create summary embed
            const summaryEmbed = new EmbedBuilder()
                .setTitle('🔄 Gym Channels Update Complete')
                .setDescription('Here\'s a summary of the update process:')
                .setColor(0x2ecc71)
                .addFields(
                    {
                        name: '📊 Update Statistics',
                        value: `✅ **Updated:** ${updatedCount} channels\n❌ **Errors:** ${errorCount} channels\n📝 **Total Processed:** ${gymChannels.length} channels`,
                        inline: false
                    },
                    {
                        name: '🎯 What Was Updated',
                        value: '• Fresh badge images\n• Updated embed styling\n• Current gym status\n• Improved descriptions\n• Better formatting',
                        inline: false
                    }
                )
                .setFooter({
                    text: `Update completed by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            // Add detailed log if there were errors
            if (errorCount > 0 || forceUpdate) {
                const logText = updateLog.slice(0, 10).join('\n'); // Show first 10 entries
                if (logText.length > 0) {
                    summaryEmbed.addFields({
                        name: '📋 Update Log (First 10 entries)',
                        value: logText.length > 1024 ? logText.substring(0, 1021) + '...' : logText,
                        inline: false
                    });
                }
            }

            await interaction.editReply({
                content: null,
                embeds: [summaryEmbed]
            });

            // Also update the info channel if it exists
            try {
                const infoChannel = guild.channels.cache.find(ch => ch.name === '📋gym-league-info');
                if (infoChannel) {
                    const infoEmbed = new EmbedBuilder()
                        .setTitle('🏆 Pokemon Gym League Information')
                        .setDescription('Welcome to the Pokemon Gym League! Here\'s how it works:')
                        .setColor(0x3498db)
                        .addFields(
                            {
                                name: '🎯 How to Battle',
                                value: 'Visit any gym channel and challenge the Gym Leader to a Pokemon battle!',
                                inline: false
                            },
                            {
                                name: '🏅 Earning Badges',
                                value: 'Win battles against Gym Leaders to earn their gym badge. Collect all badges to become a Champion!',
                                inline: false
                            },
                            {
                                name: '📊 Leaderboard',
                                value: `Check your progress on the [web leaderboard](${process.env.WEB_URL})`,
                                inline: false
                            },
                            {
                                name: '⚡ Elite Four',
                                value: 'After earning 8 gym badges, you can challenge the Elite Four members!',
                                inline: false
                            },
                            {
                                name: '👑 Champion',
                                value: 'Defeat all Elite Four members to earn the right to challenge the Champion!',
                                inline: false
                            },
                            {
                                name: '🔄 Recently Updated',
                                value: `All gym channels were updated on ${new Date().toLocaleDateString()} with fresh badge images and information!`,
                                inline: false
                            }
                        )
                        .setFooter({
                            text: 'Good luck on your Pokemon journey!'
                        })
                        .setTimestamp();

                    // Clear old messages in info channel and send new one
                    const infoMessages = await infoChannel.messages.fetch({ limit: 10 });
                    const oldInfoMessages = infoMessages.filter(msg => msg.author.id === interaction.client.user.id);
                    for (const [, message] of oldInfoMessages) {
                        try {
                            await message.delete();
                        } catch (deleteError) {
                            // Ignore delete errors
                        }
                    }

                    await infoChannel.send({ embeds: [infoEmbed] });
                }
            } catch (infoError) {
                console.log('Could not update info channel:', infoError.message);
            }

        } catch (error) {
            console.error('Error during gym update:', error);
            await interaction.editReply({
                content: '❌ An error occurred during the update process. Check the console for details.'
            });
        }
    }
};