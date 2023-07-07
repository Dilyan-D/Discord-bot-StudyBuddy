// Изискване на нужни класове от discord.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
// Изискване на нужни функции
const { hasPermissions } = require('../functions/hasPermissions');

// Настройки на командата - име, опции, описания, параметри, ...
module.exports = {
    data: new SlashCommandBuilder()
        .setName('ръководство')
        .setDescription('Изпраща хипервръзка към ръководство за използване на StudyBuddy.')
        .setDMPermission(false),

    // Изпълним код на командата
    async execute(interaction) {
        // Ако ботът не разполага със задължителните разрешения се изпраща уведомление към потребителя и собственика на сървъра и се прекратява работа.
        if (!await hasPermissions(interaction)) return;

        const embed = new EmbedBuilder()
            .setTitle('Ръководство на StudyBuddy')
            .setColor(`${process.env.embedColor}`)
            .setURL('http://studybuddy.x10.mx/#commands');

        return interaction.reply({
            embeds: [embed],
        });

    },
};