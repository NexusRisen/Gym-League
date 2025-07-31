const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = [
    {
        data: new SlashCommandBuilder()
            .setName('add')
            .setDescription('Add a gym leader to this gym channel')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The user to make a gym leader of this channel')
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        
        async execute(interaction, db) {
            await interaction.deferReply({ ephemeral: true });

            const targetUser = interaction.options.getUser('user');
            const channel = interaction.channel;
            const guild = interaction.guild;

            try {
                // Check if this is a gym channel
                const gymChannels = await db.getGymChannels(guild.id);
                const gymChannel = gymChannels.find(gc => gc.id === channel.id);

                if (!gymChannel) {
                    return await interaction.editReply({
                        content: '❌ This command can only be used in gym channels! Use this command in a channel created by `/setup`.'
                    });
                }

                // Check if user is already a gym leader of this channel
                const isAlreadyLeader = await db.isGymLeader(targetUser.id, channel.id);
                if (isAlreadyLeader) {
                    return await interaction.editReply({
                        content: `❌ ${targetUser.displayName || targetUser.username} is already a gym leader of this channel!`
                    });
                }

                // Add the gym leader
                await db.addGymLeader(
                    targetUser.id,
                    channel.id,
                    guild.id,
                    targetUser.username,
                    targetUser.displayName,
                    interaction.user.id
                );

                const embed = new EmbedBuilder()
                    .setTitle('🏅 New Gym Leader Added!')
                    .setDescription(`${targetUser} has been appointed as a gym leader for ${gymChannel.emoji} **${gymChannel.name}**!`)
                    .setColor(0x2ecc71)
                    .addFields(
                        { name: 'Gym Channel', value: channel.toString(), inline: true },
                        { name: 'New Gym Leader', value: targetUser.toString(), inline: true },
                        { name: 'Added By', value: interaction.user.toString(), inline: true },
                        { name: '📋 Available Commands', value: '• `/won @trainer` - Award badges\n• `/lose @trainer` - Log defeats\n• `/opengym` - Open gym for battles\n• `/closegym` - Close gym temporarily\n• `/cleargym` - Clear recent messages', inline: false }
                    )
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

                // Send notification to the gym channel
                try {
                    await channel.send({
                        embeds: [{
                            title: `🎉 Welcome New Gym Leader!`,
                            description: `${targetUser} is now a gym leader of this gym! They can now manage battles and gym operations.`,
                            color: 0x3498db,
                            timestamp: new Date()
                        }]
                    });
                } catch (error) {
                    console.log('Could not send notification to gym channel:', error.message);
                }

            } catch (error) {
                console.error('Error adding gym leader:', error);
                await interaction.editReply({
                    content: '❌ An error occurred while adding the gym leader.'
                });
            }
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('remove')
            .setDescription('Remove a gym leader from this gym channel')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The gym leader to remove from this channel')
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        
        async execute(interaction, db) {
            await interaction.deferReply({ ephemeral: true });

            const targetUser = interaction.options.getUser('user');
            const channel = interaction.channel;
            const guild = interaction.guild;

            try {
                // Check if this is a gym channel
                const gymChannels = await db.getGymChannels(guild.id);
                const gymChannel = gymChannels.find(gc => gc.id === channel.id);

                if (!gymChannel) {
                    return await interaction.editReply({
                        content: '❌ This command can only be used in gym channels! Use this command in a channel created by `/setup`.'
                    });
                }

                // Check if user is a gym leader of this channel
                const isGymLeader = await db.isGymLeader(targetUser.id, channel.id);
                if (!isGymLeader) {
                    return await interaction.editReply({
                        content: `❌ ${targetUser.displayName || targetUser.username} is not a gym leader of this channel!`
                    });
                }

                // Remove the gym leader
                const removed = await db.removeGymLeader(targetUser.id, channel.id);
                
                if (!removed) {
                    return await interaction.editReply({
                        content: '❌ Failed to remove gym leader. They might not be assigned to this channel.'
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle('🚪 Gym Leader Removed')
                    .setDescription(`${targetUser} has been removed as a gym leader from ${gymChannel.emoji} **${gymChannel.name}**.`)
                    .setColor(0xe74c3c)
                    .addFields(
                        { name: 'Gym Channel', value: channel.toString(), inline: true },
                        { name: 'Removed Gym Leader', value: targetUser.toString(), inline: true },
                        { name: 'Removed By', value: interaction.user.toString(), inline: true }
                    )
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

                // Send notification to the gym channel
                try {
                    await channel.send({
                        embeds: [{
                            title: `👋 Gym Leader Departure`,
                            description: `${targetUser} is no longer a gym leader of this gym. Thank you for your service!`,
                            color: 0x95a5a6,
                            timestamp: new Date()
                        }]
                    });
                } catch (error) {
                    console.log('Could not send notification to gym channel:', error.message);
                }

            } catch (error) {
                console.error('Error removing gym leader:', error);
                await interaction.editReply({
                    content: '❌ An error occurred while removing the gym leader.'
                });
            }
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('leaders')
            .setDescription('List all gym leaders in this channel or your gym leader assignments')
            .addStringOption(option =>
                option.setName('scope')
                    .setDescription('What to show')
                    .setRequired(false)
                    .addChoices(
                        { name: 'This Channel', value: 'channel' },
                        { name: 'My Assignments', value: 'me' },
                        { name: 'All Server Leaders', value: 'all' }
                    )
            ),
        
        async execute(interaction, db) {
            await interaction.deferReply({ ephemeral: true });

            const scope = interaction.options.getString('scope') || 'channel';
            const channel = interaction.channel;
            const guild = interaction.guild;
            const user = interaction.user;

            try {
                if (scope === 'channel') {
                    // Show gym leaders for this channel
                    const gymChannels = await db.getGymChannels(guild.id);
                    const gymChannel = gymChannels.find(gc => gc.id === channel.id);

                    if (!gymChannel) {
                        return await interaction.editReply({
                            content: '❌ This is not a gym channel! Use this command in a gym channel to see its leaders.'
                        });
                    }

                    const leaders = await db.getChannelGymLeaders(channel.id);

                    const embed = new EmbedBuilder()
                        .setTitle(`${gymChannel.emoji} ${gymChannel.name} - Gym Leaders`)
                        .setColor(0x3498db)
                        .setThumbnail(guild.iconURL())
                        .setTimestamp();

                    if (leaders.length === 0) {
                        embed.setDescription('❌ No gym leaders assigned to this channel yet!\n\nAdministrators can use `/add @user` to assign gym leaders.');
                    } else {
                        const leadersList = leaders.map((leader, index) => {
                            const addedDate = new Date(leader.created_at).toLocaleDateString();
                            return `**${index + 1}.** <@${leader.user_id}> (${leader.display_name || leader.username})\n└ Added on ${addedDate}`;
                        }).join('\n\n');

                        embed.setDescription(`**${leaders.length}** gym leader(s) assigned to this channel:\n\n${leadersList}`);
                    }

                    await interaction.editReply({ embeds: [embed] });

                } else if (scope === 'me') {
                    // Show user's gym leader assignments
                    const assignments = await db.getGymLeaderChannels(user.id, guild.id);

                    const embed = new EmbedBuilder()
                        .setTitle(`${user.displayName || user.username}'s Gym Leader Assignments`)
                        .setColor(0x9b59b6)
                        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                        .setTimestamp();

                    if (assignments.length === 0) {
                        embed.setDescription('❌ You are not assigned as a gym leader to any channels in this server.');
                    } else {
                        const assignmentsList = assignments.map((assignment, index) => {
                            const addedDate = new Date(assignment.created_at).toLocaleDateString();
                            return `**${index + 1}.** ${assignment.emoji} <#${assignment.channel_id}> (${assignment.channel_name})\n└ Type: ${assignment.gym_type} • Added: ${addedDate}`;
                        }).join('\n\n');

                        embed.setDescription(`You are a gym leader for **${assignments.length}** channel(s):\n\n${assignmentsList}`);
                        embed.addFields({
                            name: '💡 Your Commands',
                            value: 'In your assigned channels, you can use:\n• `/won @trainer` - Award badges\n• `/lose @trainer` - Log defeats\n• `/opengym` / `/closegym` - Manage gym status\n• `/cleargym` - Clear messages',
                            inline: false
                        });
                    }

                    await interaction.editReply({ embeds: [embed] });

                } else if (scope === 'all') {
                    // Show all gym leaders in the server (admin only)
                    if (!interaction.member.permissions.has('Administrator')) {
                        return await interaction.editReply({
                            content: '❌ Only administrators can view all server gym leaders!'
                        });
                    }

                    const gymChannels = await db.getGymChannels(guild.id);
                    
                    const embed = new EmbedBuilder()
                        .setTitle(`🏆 All Gym Leaders - ${guild.name}`)
                        .setColor(0xf39c12)
                        .setThumbnail(guild.iconURL())
                        .setTimestamp();

                    let totalLeaders = 0;
                    let description = '';

                    for (const gymChannel of gymChannels) {
                        const leaders = await db.getChannelGymLeaders(gymChannel.id);
                        totalLeaders += leaders.length;

                        description += `\n**${gymChannel.emoji} ${gymChannel.name}**\n`;
                        if (leaders.length === 0) {
                            description += '└ *No leaders assigned*\n';
                        } else {
                            leaders.forEach(leader => {
                                description += `└ <@${leader.user_id}> (${leader.display_name || leader.username})\n`;
                            });
                        }
                    }

                    embed.setDescription(`**${totalLeaders}** total gym leaders across **${gymChannels.length}** gym channels:${description}`);
                    
                    await interaction.editReply({ embeds: [embed] });
                }

            } catch (error) {
                console.error('Error listing gym leaders:', error);
                await interaction.editReply({
                    content: '❌ An error occurred while fetching gym leader information.'
                });
            }
        }
    }
];