const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const gymConfig = require('../config/gymConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('testbadges')
        .setDescription('Test badge images to see which ones are working')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Which badges to test')
                .setRequired(false)
                .addChoices(
                    { name: 'Gym Badges', value: 'gyms' },
                    { name: 'Elite Four', value: 'elite' },
                    { name: 'Champion', value: 'champion' },
                    { name: 'All', value: 'all' }
                )
        ),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const testType = interaction.options.getString('type') || 'all';

        try {
            const embeds = [];

            if (testType === 'gyms' || testType === 'all') {
                // Test first 4 gym badges
                const gymEmbed = new EmbedBuilder()
                    .setTitle('🏠 Gym Badge Test (First 4)')
                    .setDescription('Testing gym badge images...')
                    .setColor(0x3498db);

                gymConfig.gyms.slice(0, 4).forEach(gym => {
                    gymEmbed.addFields({
                        name: `${gym.emoji} ${gym.name}`,
                        value: `[Badge Link](${gym.badgeImage})`,
                        inline: true
                    });
                });

                gymEmbed.setImage(gymConfig.gyms[0].badgeImage); // Test first badge as main image
                embeds.push(gymEmbed);
            }

            if (testType === 'elite' || testType === 'all') {
                const eliteEmbed = new EmbedBuilder()
                    .setTitle('⭐ Elite Four Badge Test')
                    .setDescription('Testing Elite Four badge images...')
                    .setColor(0x9b59b6);

                gymConfig.eliteFour.forEach(elite => {
                    eliteEmbed.addFields({
                        name: `${elite.emoji} ${elite.name}`,
                        value: `[Badge Link](${elite.badgeImage})`,
                        inline: true
                    });
                });

                eliteEmbed.setImage(gymConfig.eliteFour[0].badgeImage);
                embeds.push(eliteEmbed);
            }

            if (testType === 'champion' || testType === 'all') {
                const championEmbed = new EmbedBuilder()
                    .setTitle('👑 Champion Badge Test')
                    .setDescription('Testing Champion badge image...')
                    .setColor(0xf39c12)
                    .addFields({
                        name: `${gymConfig.champion.emoji} ${gymConfig.champion.name}`,
                        value: `[Badge Link](${gymConfig.champion.badgeImage})`,
                        inline: false
                    })
                    .setImage(gymConfig.champion.badgeImage);

                embeds.push(championEmbed);
            }

            // Add instructions embed
            const instructionsEmbed = new EmbedBuilder()
                .setTitle('🔧 Badge Image Instructions')
                .setDescription('How to fix broken badge images:')
                .setColor(0xe74c3c)
                .addFields(
                    {
                        name: '1️⃣ Upload Your Own Images',
                        value: 'Upload badge images to a Discord channel, right-click → Copy Link, then update `src/config/gymConfig.js`',
                        inline: false
                    },
                    {
                        name: '2️⃣ Use Alternative Sources',
                        value: 'Try these sources:\n• [PokemonDB](https://pokemondb.net/)\n• [Serebii](https://serebii.net/)\n• [Bulbapedia](https://bulbapedia.bulbagarden.net/)',
                        inline: false
                    },
                    {
                        name: '3️⃣ After Updating',
                        value: 'Run `/update force:True` to refresh all embeds with new images',
                        inline: false
                    },
                    {
                        name: '🔗 Current Badge Sources',
                        value: 'Using GitHub PokeAPI sprites (may not work for all badges)',
                        inline: false
                    }
                );

            embeds.push(instructionsEmbed);

            await interaction.editReply({ embeds });

        } catch (error) {
            console.error('Error testing badges:', error);
            await interaction.editReply({
                content: '❌ An error occurred while testing badge images.'
            });
        }
    }
};