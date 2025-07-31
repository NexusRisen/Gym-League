const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const gymConfig = require('../config/gymConfig');

module.exports = [
    {
        data: new SlashCommandBuilder()
            .setName('help')
            .setDescription('Get help and information about the Pokemon Gym League bot'),
        
        async execute(interaction, db) {
            const embed = new EmbedBuilder()
                .setTitle('🤖 Pokemon Gym League Bot - Help')
                .setDescription('Welcome to the Pokemon Gym League! Here\'s everything you need to know.')
                .setColor(0x3498db)
                .setThumbnail(interaction.client.user.displayAvatarURL())
                .addFields(
                    {
                        name: '🎯 For Trainers',
                        value: '`/profile` - View your training progress\n' +
                               '`/badges` - See your badge collection\n' +
                               '`/leaderboard` - Check server rankings\n' +
                               '`/gyminfo` - Get information about gyms\n' +
                               '`/gymstatus` - See which gyms are open\n' +
                               '`/leaders` - View gym leader assignments',
                        inline: true
                    },
                    {
                        name: '⚔️ For Gym Leaders',
                        value: '`/won @trainer` - Award a badge for victory\n' +
                               '`/lose @trainer` - Log a battle defeat\n' +
                               '`/opengym` - Open your assigned gym\n' +
                               '`/closegym` - Close your assigned gym\n' +
                               '`/cleargym` - Clear recent messages\n' +
                               '`/leaders me` - See your assignments',
                        inline: true
                    },
                    {
                        name: '🛠️ For Admins',
                        value: '`/setup` - Initialize the gym league\n' +
                               '`/add @user` - Assign gym leader to channel\n' +
                               '`/remove @user` - Remove gym leader from channel\n' +
                               '`/leaders all` - View all server leaders\n' +
                               'All gym leader commands work for admins',
                        inline: false
                    },
                    {
                        name: '🏆 How the New System Works',
                        value: '1. **No Roles Required** - Gym leaders are stored in database\n' +
                               '2. **Channel-Specific** - Each gym channel has its own leaders\n' +
                               '3. **Easy Management** - Use `/add` and `/remove` in gym channels\n' +
                               '4. **Battle & Manage** - Leaders can only control their assigned gyms\n' +
                               '5. **Admin Override** - Administrators can use all commands',
                        inline: false
                    },
                    {
                        name: '🚀 Getting Started (Admins)',
                        value: '1. Run `/setup` to create gym channels\n' +
                               '2. Go to each gym channel and use `/add @user`\n' +
                               '3. Assigned leaders can now manage their gym\n' +
                               '4. Trainers can start challenging gym leaders!',
                        inline: false
                    },
                    {
                        name: '🌐 Web Interface',
                        value: `Visit the [web leaderboard](${process.env.WEB_URL || `http://localhost:${process.env.WEB_PORT || 3000}`}/?guild=${interaction.guild.id}) to see detailed statistics, trainer profiles, and badge collections!`,
                        inline: false
                    },
                    {
                        name: '📞 Need More Help?',
                        value: 'Ask an admin to assign you as a gym leader using `/add @you` in the gym channel you want to manage!',
                        inline: false
                    }
                )
                .setFooter({
                    text: `Pokemon Gym League Bot • Server: ${interaction.guild.name}`,
                    iconURL: interaction.guild.iconURL()
                })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('gyminfo')
            .setDescription('Get detailed information about gyms, Elite Four, and Champion')
            .addStringOption(option =>
                option.setName('category')
                    .setDescription('Which category to show information for')
                    .setRequired(false)
                    .addChoices(
                        { name: 'All Gyms', value: 'gyms' },
                        { name: 'Elite Four', value: 'elite' },
                        { name: 'Champion', value: 'champion' },
                        { name: 'Management Guide', value: 'management' },
                        { name: 'Overview', value: 'overview' }
                    )
            ),
        
        async execute(interaction, db) {
            await interaction.deferReply();

            const category = interaction.options.getString('category') || 'overview';

            try {
                let embed;

                switch (category) {
                    case 'management':
                        embed = new EmbedBuilder()
                            .setTitle('👥 Gym Leader Management Guide')
                            .setDescription('How to manage gym leaders in the new database system')
                            .setColor(0x2ecc71);

                        embed.addFields(
                            {
                                name: '🔧 For Administrators',
                                value: '**Assigning Gym Leaders:**\n' +
                                       '• Go to any gym channel\n' +
                                       '• Use `/add @user` to assign them as gym leader\n' +
                                       '• Use `/remove @user` to remove gym leader\n' +
                                       '• Use `/leaders all` to see all assignments\n\n' +
                                       '**Benefits:**\n' +
                                       '• No Discord roles needed\n' +
                                       '• Channel-specific permissions\n' +
                                       '• Easy to manage and track',
                                inline: false
                            },
                            {
                                name: '⚔️ For Gym Leaders',
                                value: '**Your Commands (in assigned channels only):**\n' +
                                       '• `/won @trainer` - Award badges to winners\n' +
                                       '• `/lose @trainer` - Log trainer defeats\n' +
                                       '• `/opengym` - Open your gym for battles\n' +
                                       '• `/closegym` - Close your gym temporarily\n' +
                                       '• `/cleargym [amount]` - Clear recent messages\n' +
                                       '• `/leaders me` - See your gym assignments',
                                inline: false
                            },
                            {
                                name: '📋 Channel Restrictions',
                                value: '• Gym leader commands only work in assigned channels\n' +
                                       '• Each gym can have multiple leaders\n' +
                                       '• Leaders cannot affect other gyms\n' +
                                       '• Administrators can use all commands everywhere',
                                inline: false
                            },
                            {
                                name: '🎯 Quick Setup Example',
                                value: '1. Admin runs `/setup` (creates all gym channels)\n' +
                                       '2. Admin goes to Rock Gym channel\n' +
                                       '3. Admin uses `/add @rocktrainer`\n' +
                                       '4. @rocktrainer can now manage Rock Gym battles\n' +
                                       '5. Repeat for each gym with different users',
                                inline: false
                            }
                        );
                        break;

                    case 'gyms':
                        embed = new EmbedBuilder()
                            .setTitle('🏠 Gym Leaders Information')
                            .setDescription('Challenge these 18 gym leaders to earn their badges!')
                            .setColor(0x2ecc71);

                        // Split gyms into chunks for multiple fields
                        const gymChunks = [];
                        for (let i = 0; i < gymConfig.gyms.length; i += 6) {
                            gymChunks.push(gymConfig.gyms.slice(i, i + 6));
                        }

                        gymChunks.forEach((chunk, index) => {
                            const gymList = chunk.map(gym => 
                                `${gym.emoji} **${gym.name}** - ${gym.type.toUpperCase()}`
                            ).join('\n');
                            
                            embed.addFields({
                                name: `Gyms ${index * 6 + 1}-${Math.min((index + 1) * 6, gymConfig.gyms.length)}`,
                                value: gymList,
                                inline: true
                            });
                        });

                        embed.addFields({
                            name: '💡 How to Battle',
                            value: 'Visit any gym channel and challenge the gym leader! Each gym specializes in a different Pokemon type.',
                            inline: false
                        });
                        break;

                    case 'elite':
                        embed = new EmbedBuilder()
                            .setTitle('⭐ Elite Four Information')
                            .setDescription('The ultimate challenge before facing the Champion!')
                            .setColor(0x9b59b6);

                        const eliteList = gymConfig.eliteFour.map(elite => 
                            `${elite.emoji} **${elite.name}**\n${elite.description}`
                        ).join('\n\n');

                        embed.addFields(
                            {
                                name: 'Elite Four Members',
                                value: eliteList,
                                inline: false
                            },
                            {
                                name: '📋 Requirements',
                                value: '• Earn at least 8 gym badges\n• Challenge each Elite Four member\n• Prove your mastery of Pokemon training',
                                inline: false
                            },
                            {
                                name: '🎯 Strategy Tips',
                                value: 'Each Elite Four member specializes in a specific type. Prepare diverse teams and strategies!',
                                inline: false
                            }
                        );
                        break;

                    case 'champion':
                        embed = new EmbedBuilder()
                            .setTitle('👑 Champion Information')
                            .setDescription(gymConfig.champion.description)
                            .setColor(0xf39c12)
                            .setThumbnail(gymConfig.champion.badgeImage);

                        embed.addFields(
                            {
                                name: `${gymConfig.champion.emoji} ${gymConfig.champion.name}`,
                                value: 'The ultimate test for any Pokemon trainer. Only those who have conquered all challenges may face the Champion.',
                                inline: false
                            },
                            {
                                name: '📋 Requirements to Challenge',
                                value: '• Defeat all 8 Gym Leaders\n• Defeat all 4 Elite Four members\n• Prove you are worthy of the title',
                                inline: false
                            },
                            {
                                name: '🏆 Champion Rewards',
                                value: 'Earn the Champion badge and eternal glory in the Pokemon League! Your name will be remembered forever.',
                                inline: false
                            },
                            {
                                name: '⚡ The Ultimate Battle',
                                value: 'The Champion uses Pokemon of all types and represents the pinnacle of Pokemon training excellence.',
                                inline: false
                            }
                        );
                        break;

                    default: // overview
                        embed = new EmbedBuilder()
                            .setTitle('🏆 Pokemon Gym League Overview')
                            .setDescription('Your complete guide to becoming a Pokemon Champion!')
                            .setColor(0x3498db);

                        embed.addFields(
                            {
                                name: '🏠 Gym Leaders (18 Total)',
                                value: `${gymConfig.gyms.length} unique gyms await your challenge! Each specializes in a different Pokemon type.`,
                                inline: true
                            },
                            {
                                name: '⭐ Elite Four (4 Members)',
                                value: `${gymConfig.eliteFour.length} elite trainers guard the path to the Champion. Requires 8+ gym badges.`,
                                inline: true
                            },
                            {
                                name: '👑 Champion (1 Final Boss)',
                                value: 'The ultimate challenge awaiting those who defeat the Elite Four.',
                                inline: true
                            },
                            {
                                name: '🎯 Your Journey',
                                value: '**Step 1:** Challenge gym leaders (any order)\n' +
                                       '**Step 2:** Earn 8+ gym badges\n' +
                                       '**Step 3:** Challenge the Elite Four\n' +
                                       '**Step 4:** Face the Champion\n' +
                                       '**Step 5:** Become a Pokemon Master!',
                                inline: false
                            },
                            {
                                name: '🏅 New Management System',
                                value: '• **No Discord roles needed** - Gym leaders stored in database\n' +
                                       '• **Channel-specific** - Each gym has its own leaders\n' +
                                       '• **Easy management** - Admins use `/add @user` in gym channels\n' +
                                       '• Use `/gyminfo management` for detailed setup guide',
                                inline: false
                            },
                            {
                                name: '🌐 Web Interface',
                                value: `[View detailed gym guide](${process.env.WEB_URL || `http://localhost:${process.env.WEB_PORT || 3000}`}/gyms) with all gym information and strategies!`,
                                inline: false
                            }
                        );
                        break;
                }

                embed.setFooter({
                    text: `Use /gyminfo with different categories for specific info • ${interaction.guild.name}`,
                    iconURL: interaction.guild.iconURL()
                });

                embed.setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Error showing gym info:', error);
                await interaction.editReply({
                    content: '❌ An error occurred while fetching gym information.'
                });
            }
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('about')
            .setDescription('Information about the Pokemon Gym League bot'),
        
        async execute(interaction, db) {
            const embed = new EmbedBuilder()
                .setTitle('🤖 About Pokemon Gym League Bot')
                .setDescription('A comprehensive Discord bot for managing Pokemon Gym League battles and badge collection!')
                .setColor(0xe74c3c)
                .setThumbnail(interaction.client.user.displayAvatarURL())
                .addFields(
                    {
                        name: '✨ Features',
                        value: '• 18 Unique Pokemon Gyms\n' +
                               '• Elite Four Challenges\n' +
                               '• Champion Battles\n' +
                               '• Badge Collection System\n' +
                               '• Web Leaderboard Interface\n' +
                               '• Database-driven Gym Leaders\n' +
                               '• Real-time Progress Tracking',
                        inline: true
                    },
                    {
                        name: '📊 Statistics',
                        value: `• **Servers:** ${interaction.client.guilds.cache.size}\n` +
                               `• **Channels:** ${interaction.client.channels.cache.size}\n` +
                               `• **Users:** ${interaction.client.users.cache.size}\n` +
                               '• **Uptime:** ' + Math.floor(interaction.client.uptime / 1000 / 60) + ' minutes',
                        inline: true
                    },
                    {
                        name: '🔧 New Management System',
                        value: '• **No Discord Roles** - Uses database storage\n' +
                               '• **Channel-Specific** - Leaders assigned per gym\n' +
                               '• **Easy Administration** - Simple `/add` and `/remove`\n' +
                               '• **Automatic Setup** - Database auto-creates/updates',
                        inline: false
                    },
                    {
                        name: '🛠️ Technology Stack',
                        value: '• **Discord.js** - Bot framework\n' +
                               '• **SQLite3** - Database with auto-management\n' +
                               '• **Express.js** - Web server\n' +
                               '• **Node.js** - Runtime environment',
                        inline: false
                    },
                    {
                        name: '🌐 Web Interface',
                        value: `Check your progress on the [web leaderboard](${process.env.WEB_URL})`,
                        inline: false
                    },
                    {
                        name: '📞 Support',
                        value: 'For help and support, use `/help` or contact your server administrators. Use `/gyminfo management` for setup guides.',
                        inline: false
                    }
                )
                .setFooter({
                    text: `Version 2.0.0 • Database System • Running on ${interaction.guild.name}`,
                    iconURL: interaction.guild.iconURL()
                })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
];