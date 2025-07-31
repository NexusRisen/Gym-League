const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const gymConfig = require('../config/gymConfig');

// Helper function to check if user is gym leader of specific channel
async function isGymLeaderOfChannel(db, userId, channelId, member) {
    // Check database first
    const isLeader = await db.isGymLeader(userId, channelId);
    
    // Also allow administrators to use commands
    const isAdmin = member.permissions.has('Administrator');
    
    return isLeader || isAdmin;
}

// Helper function to get gym info from channel
function getGymFromChannel(channelName) {
    // Find gym by channel name
    let gym = gymConfig.gyms.find(g => 
        channelName.includes(g.type) || 
        channelName.includes(g.name.toLowerCase().replace(' ', '-'))
    );
    
    if (!gym) {
        gym = gymConfig.eliteFour.find(e => 
            channelName.includes(e.type) || 
            channelName.includes(e.name.toLowerCase().replace(/\s+/g, '-'))
        );
    }
    
    if (!gym && channelName.includes('champion')) {
        gym = gymConfig.champion;
    }
    
    return gym;
}

module.exports = [
    {
        data: new SlashCommandBuilder()
            .setName('won')
            .setDescription('Award a badge to a trainer who won the battle')
            .addUserOption(option =>
                option.setName('trainer')
                    .setDescription('The trainer who won the battle')
                    .setRequired(true)
            ),
        
        async execute(interaction, db) {
            await interaction.deferReply();

            const trainer = interaction.options.getUser('trainer');
            const channel = interaction.channel;

            try {
                // Check if user is gym leader of this channel
                const canUseCommand = await isGymLeaderOfChannel(db, interaction.user.id, channel.id, interaction.member);
                
                if (!canUseCommand) {
                    return await interaction.editReply({
                        content: '❌ Only gym leaders of this channel can award badges! An administrator can assign you using `/add @user` in this channel.'
                    });
                }

                // Verify this is a gym channel
                const gymChannels = await db.getGymChannels(interaction.guild.id);
                const gymChannel = gymChannels.find(gc => gc.id === channel.id);

                if (!gymChannel) {
                    return await interaction.editReply({
                        content: '❌ This command can only be used in gym channels created by `/setup`!'
                    });
                }

                // Get gym configuration
                let gym = null;
                if (gymChannel.type === 'champion') {
                    gym = gymConfig.champion;
                } else if (gymChannel.type.includes('elite')) {
                    gym = gymConfig.eliteFour.find(e => e.type === gymChannel.type);
                } else {
                    gym = gymConfig.gyms.find(g => g.type === gymChannel.type);
                }

                if (!gym) {
                    return await interaction.editReply({
                        content: '❌ Could not find gym configuration for this channel!'
                    });
                }

                // Add trainer to database if not exists
                await db.addTrainer(trainer.id, interaction.guild.id, trainer.username, trainer.displayName);
                
                // Check if trainer already has this badge
                const existingBadges = await db.getTrainerBadges(trainer.id);
                const hasBadge = existingBadges.some(badge => badge.gym_type === gym.type);
                
                if (hasBadge) {
                    return await interaction.editReply({
                        content: `❌ ${trainer.displayName || trainer.username} already has the ${gym.name} badge!`
                    });
                }

                // Award the badge
                await db.awardBadge(trainer.id, gym.type, gym.name, gym.badgeImage, interaction.user.id);
                
                // Log the battle
                await db.logBattle(interaction.guild.id, trainer.id, gym.type, 'won', interaction.user.id);

                const embed = new EmbedBuilder()
                    .setTitle(`🏅 Badge Awarded!`)
                    .setDescription(`Congratulations ${trainer}! You have earned the **${gym.name}** badge!`)
                    .setColor(parseInt(gym.color.replace('#', ''), 16))
                    .setThumbnail(gym.badgeImage)
                    .addFields(
                        { name: 'Gym', value: gym.name, inline: true },
                        { name: 'Gym Leader', value: interaction.user.toString(), inline: true },
                        { name: 'Battle Result', value: '🏆 Victory!', inline: true }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

                // Get updated trainer info
                const updatedTrainer = await db.getTrainer(trainer.id);
                const totalBadges = await db.getTrainerBadges(trainer.id);
                
                // Check for milestones
                if (totalBadges.length === 8) {
                    await channel.send({
                        embeds: [{
                            title: '🌟 Milestone Achieved!',
                            description: `${trainer} has earned 8 gym badges and can now challenge the Elite Four!`,
                            color: 0xffd700
                        }]
                    });
                } else if (totalBadges.length === 12) { // 8 gyms + 4 elite four
                    await channel.send({
                        embeds: [{
                            title: '👑 Elite Status!',
                            description: `${trainer} has defeated the Elite Four and can now challenge the Champion!`,
                            color: 0xff6b6b
                        }]
                    });
                }

            } catch (error) {
                console.error('Error awarding badge:', error);
                await interaction.editReply({
                    content: '❌ An error occurred while awarding the badge.'
                });
            }
        }
    },
    
    {
        data: new SlashCommandBuilder()
            .setName('lose')
            .setDescription('Log a battle loss (no badge awarded)')
            .addUserOption(option =>
                option.setName('trainer')
                    .setDescription('The trainer who lost the battle')
                    .setRequired(true)
            ),
        
        async execute(interaction, db) {
            await interaction.deferReply();

            const trainer = interaction.options.getUser('trainer');
            const channel = interaction.channel;

            try {
                // Check if user is gym leader of this channel
                const canUseCommand = await isGymLeaderOfChannel(db, interaction.user.id, channel.id, interaction.member);
                
                if (!canUseCommand) {
                    return await interaction.editReply({
                        content: '❌ Only gym leaders of this channel can log battle results! An administrator can assign you using `/add @user` in this channel.'
                    });
                }

                // Verify this is a gym channel
                const gymChannels = await db.getGymChannels(interaction.guild.id);
                const gymChannel = gymChannels.find(gc => gc.id === channel.id);

                if (!gymChannel) {
                    return await interaction.editReply({
                        content: '❌ This command can only be used in gym channels created by `/setup`!'
                    });
                }

                // Get gym configuration
                let gym = null;
                if (gymChannel.type === 'champion') {
                    gym = gymConfig.champion;
                } else if (gymChannel.type.includes('elite')) {
                    gym = gymConfig.eliteFour.find(e => e.type === gymChannel.type);
                } else {
                    gym = gymConfig.gyms.find(g => g.type === gymChannel.type);
                }

                if (!gym) {
                    return await interaction.editReply({
                        content: '❌ Could not find gym configuration for this channel!'
                    });
                }

                // Add trainer to database if not exists
                await db.addTrainer(trainer.id, interaction.guild.id, trainer.username, trainer.displayName);
                
                // Log the battle
                await db.logBattle(interaction.guild.id, trainer.id, gym.type, 'lost', interaction.user.id);

                const embed = new EmbedBuilder()
                    .setTitle(`💔 Battle Lost`)
                    .setDescription(`${trainer} fought valiantly but was defeated by the ${gym.name} Gym Leader.`)
                    .setColor(0xe74c3c)
                    .setThumbnail(gym.badgeImage)
                    .addFields(
                        { name: 'Gym', value: gym.name, inline: true },
                        { name: 'Gym Leader', value: interaction.user.toString(), inline: true },
                        { name: 'Battle Result', value: '💔 Defeat', inline: true },
                        { name: 'Encouragement', value: 'Train harder and come back stronger!', inline: false }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Error logging battle:', error);
                await interaction.editReply({
                    content: '❌ An error occurred while logging the battle.'
                });
            }
        }
    }
];