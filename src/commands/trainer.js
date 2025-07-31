const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const gymConfig = require('../config/gymConfig');

module.exports = [
    {
        data: new SlashCommandBuilder()
            .setName('profile')
            .setDescription('View your or another trainer\'s profile and badge collection')
            .addUserOption(option =>
                option.setName('trainer')
                    .setDescription('The trainer to view (leave empty for yourself)')
                    .setRequired(false)
            ),
        
        async execute(interaction, db) {
            await interaction.deferReply();

            const targetUser = interaction.options.getUser('trainer') || interaction.user;
            const guild = interaction.guild;

            try {
                // Get trainer from database
                let trainer = await db.getTrainer(targetUser.id);
                
                if (!trainer) {
                    // Add trainer if not exists
                    await db.addTrainer(targetUser.id, guild.id, targetUser.username, targetUser.displayName);
                    trainer = await db.getTrainer(targetUser.id);
                }

                // Get trainer badges
                const badges = await db.getTrainerBadges(targetUser.id);
                
                // Separate badges by type
                const gymBadges = badges.filter(b => !b.gym_type.includes('elite') && b.gym_type !== 'champion');
                const eliteBadges = badges.filter(b => b.gym_type.includes('elite'));
                const championBadge = badges.find(b => b.gym_type === 'champion');

                // Calculate progress
                const gymProgress = `${gymBadges.length}/${gymConfig.gyms.length}`;
                const eliteProgress = `${eliteBadges.length}/${gymConfig.eliteFour.length}`;
                const championProgress = championBadge ? '1/1' : '0/1';

                // Create embed
                const embed = new EmbedBuilder()
                    .setTitle(`${targetUser.displayName || targetUser.username}'s Trainer Profile`)
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                    .setColor(0x3498db)
                    .addFields(
                        {
                            name: '📊 Training Progress',
                            value: `🏅 **Gym Badges:** ${gymProgress}\n⭐ **Elite Four:** ${eliteProgress}\n👑 **Champion:** ${championProgress}`,
                            inline: true
                        },
                        {
                            name: '🎯 Total Achievements',
                            value: `🏆 **Total Badges:** ${badges.length}\n📅 **Trainer Since:** ${new Date(trainer.created_at).toLocaleDateString()}`,
                            inline: true
                        }
                    );

                // Add recent badges field
                if (badges.length > 0) {
                    const recentBadges = badges.slice(0, 5).map(badge => {
                        const gymInfo = [...gymConfig.gyms, ...gymConfig.eliteFour].find(g => g.type === badge.gym_type) || gymConfig.champion;
                        return `${gymInfo ? gymInfo.emoji : '🏅'} ${badge.gym_name}`;
                    }).join('\n');
                    
                    embed.addFields({
                        name: '🆕 Recent Badges',
                        value: recentBadges,
                        inline: false
                    });
                } else {
                    embed.addFields({
                        name: '🎯 Getting Started',
                        value: 'No badges earned yet! Visit any gym channel to begin your Pokemon journey.',
                        inline: false
                    });
                }

                // Add achievement status
                const achievements = [];
                if (badges.length >= 1) achievements.push('🌟 First Steps');
                if (gymBadges.length >= 4) achievements.push('🔥 Rising Star');
                if (gymBadges.length >= 8) achievements.push('👑 League Challenger');
                if (eliteBadges.length >= 4) achievements.push('⭐ Elite Trainer');
                if (championBadge) achievements.push('🏆 Champion');

                if (achievements.length > 0) {
                    embed.addFields({
                        name: '🏅 Achievements Unlocked',
                        value: achievements.join(' • '),
                        inline: false
                    });
                }

                // Add web profile link
                embed.addFields({
                    name: '🌐 Full Profile',
                    value: `[View detailed profile on web](${process.env.WEB_URL || `http://localhost:${process.env.WEB_PORT || 3000}`}/trainer/${targetUser.id})`,
                    inline: false
                });

                embed.setFooter({
                    text: `Use /badges to see all earned badges • Profile for ${targetUser.username}`,
                    iconURL: guild.iconURL()
                });

                embed.setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Error fetching trainer profile:', error);
                await interaction.editReply({
                    content: '❌ An error occurred while fetching the trainer profile.'
                });
            }
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('badges')
            .setDescription('View detailed badge collection for yourself or another trainer')
            .addUserOption(option =>
                option.setName('trainer')
                    .setDescription('The trainer to view badges for (leave empty for yourself)')
                    .setRequired(false)
            ),
        
        async execute(interaction, db) {
            await interaction.deferReply();

            const targetUser = interaction.options.getUser('trainer') || interaction.user;
            const guild = interaction.guild;

            try {
                // Get trainer badges
                const badges = await db.getTrainerBadges(targetUser.id);
                
                if (badges.length === 0) {
                    const embed = new EmbedBuilder()
                        .setTitle(`${targetUser.displayName || targetUser.username}'s Badge Collection`)
                        .setDescription('🎯 No badges earned yet!\n\nStart your Pokemon journey by challenging gym leaders in their respective channels.')
                        .setColor(0xe74c3c)
                        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                        .addFields({
                            name: '💡 How to Get Started',
                            value: '• Visit any gym channel\n• Challenge the gym leader to a battle\n• Win to earn their badge!\n• Collect all badges to become Champion',
                            inline: false
                        })
                        .setFooter({
                            text: `Badge collection for ${targetUser.username}`,
                            iconURL: guild.iconURL()
                        })
                        .setTimestamp();

                    return await interaction.editReply({ embeds: [embed] });
                }

                // Separate badges by category
                const gymBadges = badges.filter(b => !b.gym_type.includes('elite') && b.gym_type !== 'champion');
                const eliteBadges = badges.filter(b => b.gym_type.includes('elite'));
                const championBadge = badges.find(b => b.gym_type === 'champion');

                const embed = new EmbedBuilder()
                    .setTitle(`${targetUser.displayName || targetUser.username}'s Badge Collection`)
                    .setDescription(`🏆 **Total Badges:** ${badges.length}`)
                    .setColor(0xf39c12)
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }));

                // Add gym badges section
                if (gymBadges.length > 0) {
                    const gymBadgeList = gymBadges.map(badge => {
                        const gymInfo = gymConfig.gyms.find(g => g.type === badge.gym_type);
                        const earnedDate = new Date(badge.earned_at).toLocaleDateString();
                        return `${gymInfo ? gymInfo.emoji : '🏅'} **${badge.gym_name}** - ${earnedDate}`;
                    }).join('\n');

                    embed.addFields({
                        name: `🏅 Gym Badges (${gymBadges.length}/${gymConfig.gyms.length})`,
                        value: gymBadgeList,
                        inline: false
                    });
                }

                // Add Elite Four section
                if (eliteBadges.length > 0) {
                    const eliteBadgeList = eliteBadges.map(badge => {
                        const eliteInfo = gymConfig.eliteFour.find(e => e.type === badge.gym_type);
                        const earnedDate = new Date(badge.earned_at).toLocaleDateString();
                        return `${eliteInfo ? eliteInfo.emoji : '⭐'} **${badge.gym_name}** - ${earnedDate}`;
                    }).join('\n');

                    embed.addFields({
                        name: `⭐ Elite Four (${eliteBadges.length}/${gymConfig.eliteFour.length})`,
                        value: eliteBadgeList,
                        inline: false
                    });
                }

                // Add Champion section
                if (championBadge) {
                    const earnedDate = new Date(championBadge.earned_at).toLocaleDateString();
                    embed.addFields({
                        name: '👑 Champion (1/1)',
                        value: `${gymConfig.champion.emoji} **${championBadge.gym_name}** - ${earnedDate}`,
                        inline: false
                    });
                }

                // Add progress indicators
                let nextGoal = '';
                if (gymBadges.length < 8) {
                    nextGoal = `🎯 **Next Goal:** Earn ${8 - gymBadges.length} more gym badges to challenge the Elite Four`;
                } else if (eliteBadges.length < 4) {
                    nextGoal = `🎯 **Next Goal:** Defeat ${4 - eliteBadges.length} more Elite Four members`;
                } else if (!championBadge) {
                    nextGoal = '🎯 **Next Goal:** Challenge the Champion to complete your journey!';
                } else {
                    nextGoal = '🎉 **Congratulations!** You have completed the Pokemon League!';
                }

                embed.addFields({
                    name: '📈 Progress',
                    value: nextGoal,
                    inline: false
                });

                // Add most recent badge
                const mostRecent = badges[0];
                const recentDate = new Date(mostRecent.earned_at).toLocaleDateString();
                embed.addFields({
                    name: '🆕 Most Recent Badge',
                    value: `**${mostRecent.gym_name}** earned on ${recentDate}`,
                    inline: true
                });

                embed.setFooter({
                    text: `Use /profile for overview • Badge collection for ${targetUser.username}`,
                    iconURL: guild.iconURL()
                });

                embed.setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Error fetching badges:', error);
                await interaction.editReply({
                    content: '❌ An error occurred while fetching the badge collection.'
                });
            }
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('leaderboard')
            .setDescription('View the top trainers in the Pokemon League'),
        
        async execute(interaction, db) {
            await interaction.deferReply();

            try {
                const leaderboard = await db.getLeaderboard(interaction.guild.id);
                
                if (leaderboard.length === 0) {
                    const embed = new EmbedBuilder()
                        .setTitle('🏆 Pokemon League Leaderboard')
                        .setDescription('No trainers have started their journey yet!\n\nUse `/setup` to initialize the gym league, then start challenging gym leaders!')
                        .setColor(0x3498db)
                        .setFooter({
                            text: `Leaderboard for ${interaction.guild.name}`,
                            iconURL: interaction.guild.iconURL()
                        })
                        .setTimestamp();

                    return await interaction.editReply({ embeds: [embed] });
                }

                // Get top 10 trainers
                const topTrainers = leaderboard.slice(0, 10);

                const embed = new EmbedBuilder()
                    .setTitle('🏆 Pokemon League Leaderboard')
                    .setDescription('Top trainers in the Pokemon League ranked by badges earned')
                    .setColor(0xf39c12);

                // Create leaderboard text
                let leaderboardText = '';
                for (let i = 0; i < topTrainers.length; i++) {
                    const trainer = topTrainers[i];
                    let rankEmoji = '';
                    
                    switch (i) {
                        case 0: rankEmoji = '🥇'; break;
                        case 1: rankEmoji = '🥈'; break;
                        case 2: rankEmoji = '🥉'; break;
                        default: rankEmoji = `${i + 1}.`; break;
                    }

                    const badgeCount = trainer.badge_count || 0;
                    leaderboardText += `${rankEmoji} **${trainer.display_name || trainer.username}** - ${badgeCount} badges\n`;
                }

                embed.addFields({
                    name: '👥 Top Trainers',
                    value: leaderboardText,
                    inline: false
                });

                // Add server stats
                const totalTrainers = leaderboard.length;
                const totalBadges = leaderboard.reduce((sum, trainer) => sum + (trainer.badge_count || 0), 0);
                const championsCount = leaderboard.filter(trainer => trainer.badge_count >= (gymConfig.gyms.length + gymConfig.eliteFour.length + 1)).length;

                embed.addFields({
                    name: '📊 Server Statistics',
                    value: `👥 **Total Trainers:** ${totalTrainers}\n🏅 **Total Badges Earned:** ${totalBadges}\n👑 **Champions:** ${championsCount}`,
                    inline: false
                });

                // Add web link
                embed.addFields({
                    name: '🌐 Full Leaderboard',
                    value: `Check your progress on the [web leaderboard](${process.env.WEB_URL})`,
                    inline: false
                });

                embed.setFooter({
                    text: `Leaderboard for ${interaction.guild.name}`,
                    iconURL: interaction.guild.iconURL()
                });

                embed.setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Error fetching leaderboard:', error);
                await interaction.editReply({
                    content: '❌ An error occurred while fetching the leaderboard.'
                });
            }
        }
    }
];