const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const gymConfig = require('../config/gymConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Set up the Pokemon Gym League channels and category')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction, db) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guild = interaction.guild;
        const guildId = guild.id;

        try {
            // Check if already set up
            const existingGuild = await db.getGuild(guildId);
            if (existingGuild && existingGuild.setup_completed) {
                return await interaction.editReply({
                    content: '❌ Pokemon Gym League is already set up in this server!'
                });
            }

            // Add guild to database
            await db.addGuild(guildId, guild.name);

            // Create main category
            const category = await guild.channels.create({
                name: '🏆 Pokemon Gym League',
                type: ChannelType.GuildCategory,
                position: 0
            });

            // Create gym channels
            const createdChannels = [];
            
            // Regular gyms
            for (const gym of gymConfig.gyms) {
                const channel = await guild.channels.create({
                    name: `${gym.emoji}${gym.name.toLowerCase().replace(' ', '-')}`,
                    type: ChannelType.GuildText,
                    parent: category,
                    topic: gym.description,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                        }
                    ]
                });

                await db.addGymChannel(channel.id, guildId, gym.name, gym.type, gym.emoji);
                createdChannels.push(channel);

                // Add welcome message
                await channel.send({
                    embeds: [{
                        title: `${gym.emoji} Welcome to ${gym.name}!`,
                        description: gym.description,
                        color: parseInt(gym.color.replace('#', ''), 16),
                        fields: [
                            {
                                name: 'How to Battle',
                                value: 'Challenge the Gym Leader and prove your worth to earn the badge!',
                                inline: false
                            },
                            {
                                name: 'Gym Status',
                                value: '🟢 Open for battles',
                                inline: true
                            }
                        ],
                        thumbnail: {
                            url: gym.badgeImage
                        },
                        timestamp: new Date()
                    }]
                });
            }

            // Elite Four channels
            for (const elite of gymConfig.eliteFour) {
                const channel = await guild.channels.create({
                    name: `${elite.emoji}${elite.name.toLowerCase().replace(/\s+/g, '-')}`,
                    type: ChannelType.GuildText,
                    parent: category,
                    topic: elite.description,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                        }
                    ]
                });

                await db.addGymChannel(channel.id, guildId, elite.name, elite.type, elite.emoji);
                createdChannels.push(channel);

                await channel.send({
                    embeds: [{
                        title: `${elite.emoji} ${elite.name}`,
                        description: elite.description,
                        color: parseInt(elite.color.replace('#', ''), 16),
                        fields: [
                            {
                                name: 'Elite Challenge',
                                value: 'Only the strongest trainers may challenge the Elite Four!',
                                inline: false
                            },
                            {
                                name: 'Requirements',
                                value: 'You must have earned at least 8 gym badges to challenge the Elite Four.',
                                inline: false
                            }
                        ],
                        thumbnail: {
                            url: elite.badgeImage
                        },
                        timestamp: new Date()
                    }]
                });
            }

            // Champion channel
            const championChannel = await guild.channels.create({
                name: `${gymConfig.champion.emoji}${gymConfig.champion.name.toLowerCase().replace(/\s+/g, '-')}`,
                type: ChannelType.GuildText,
                parent: category,
                topic: gymConfig.champion.description,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    }
                ]
            });

            await db.addGymChannel(championChannel.id, guildId, gymConfig.champion.name, gymConfig.champion.type, gymConfig.champion.emoji);
            createdChannels.push(championChannel);

            await championChannel.send({
                embeds: [{
                    title: `${gymConfig.champion.emoji} ${gymConfig.champion.name}`,
                    description: gymConfig.champion.description,
                    color: parseInt(gymConfig.champion.color.replace('#', ''), 16),
                    fields: [
                        {
                            name: 'Champion Challenge',
                            value: 'The ultimate test for Pokemon trainers!',
                            inline: false
                        },
                        {
                            name: 'Requirements',
                            value: 'You must defeat all Elite Four members to challenge the Champion.',
                            inline: false
                        }
                    ],
                    thumbnail: {
                        url: gymConfig.champion.badgeImage
                    },
                    timestamp: new Date()
                }]
            });

            // Update guild setup status
            await db.updateGuildSetup(guildId, category.id);

            // Create general info channel
            const infoChannel = await guild.channels.create({
                name: '📋gym-league-info',
                type: ChannelType.GuildText,
                parent: category,
                topic: 'Information about the Pokemon Gym League system',
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                        deny: [PermissionFlagsBits.SendMessages]
                    }
                ]
            });

            await infoChannel.send({
                embeds: [{
                    title: '🏆 Pokemon Gym League Information',
                    description: 'Welcome to the Pokemon Gym League! Here\'s how it works:',
                    color: 0x3498db,
                    fields: [
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
                            value: `Check your progress on the web leaderboard: ${process.env.WEB_URL || `http://localhost:${process.env.WEB_PORT || 3000}`}`,
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
                            name: '👥 Gym Leader Management',
                            value: 'Administrators can assign gym leaders using `/addgymleader @user` in each gym channel.',
                            inline: false
                        }
                    ],
                    footer: {
                        text: 'Good luck on your Pokemon journey!'
                    },
                    timestamp: new Date()
                }]
            });

            await interaction.editReply({
                content: `✅ **Pokemon Gym League setup complete!**\n\n` +
                        `🏆 **Created category:** ${category.name}\n` +
                        `📝 **Created channels:** ${createdChannels.length + 1} total\n` +
                        `🌐 **Web leaderboard:** ${process.env.WEB_URL || `http://localhost:${process.env.WEB_PORT || 3000}`}\n\n` +
                        `**🚀 Next Steps:**\n` +
                        `1. Visit each gym channel\n` +
                        `2. Use \`/addgymleader @user\` to assign gym leaders\n` +
                        `3. Gym leaders can start managing battles!\n` +
                        `4. Trainers can begin their Pokemon journey!\n\n` +
                        `**📋 Database Status:** ✅ All gym channels registered\n` +
                        `**🔧 System Status:** ✅ Ready for battles`
            });

        } catch (error) {
            console.error('Setup error:', error);
            await interaction.editReply({
                content: '❌ **Setup Error**\n\n' +
                        `An error occurred during setup: ${error.message}\n\n` +
                        'Please check the bot\'s permissions and try again.\n' +
                        'The bot needs permissions to:\n' +
                        '• Create channels\n' +
                        '• Manage channels\n' +
                        '• Send messages\n' +
                        '• Embed links'
            });
        }
    }
};