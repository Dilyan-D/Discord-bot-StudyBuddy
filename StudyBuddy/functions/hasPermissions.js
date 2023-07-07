// Изискване на нужни класове от discord.js
const { PermissionsBitField, EmbedBuilder } = require('discord.js');

async function hasPermissions(interaction) {
    if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        interaction.reply('Услугите ми не са налични, тъй като не разполагам с необходимото разрешение за редактиране на съобщения в този канал. Собственикът на този канал бе уведомен за това.');
        const guildOwner = await interaction.guild.fetchOwner();
        const embed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('Внимание: StudyBuddy се нуждае от разрешение за изпращане и редактиране на съобщения!')
            .setDescription(
                `Здравейте! Уведомявам Ви, че току-що във ваш сървър бе извършен неуспешен опит за използване на моя команда. ` +
                `Моля, разрешете на StudyBuddy да изпраща и редактира текстови съобщения в съответния канал.` +
                `\n\nНеобходимите разрешения са Изпращане на съобщения (на англ.: Send Messages) и Управление на съобщенията (на англ.: Manage Messages).` +
                `\n\n**Информация за събитието:**` +
                `\n**Сървър:** ${interaction.guild.name}` +
                `\n**Канал:** ${interaction.channel.name}` +
                `\n**Член:** ${interaction.member.user.tag}`
            );
        guildOwner.send({ embeds: [embed] });
        return false;
    }
    else if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.SendMessages)) {
        interaction.member.send('Не разполагам с необходимите разрешения за изпращане и редактиране на съобщения в този канал.');

        const guildOwner = await interaction.guild.fetchOwner();
        const embed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('Внимание: StudyBuddy се нуждае от разрешение за изпращане и редактиране на съобщения!')
            .setDescription(
                `Здравейте! Уведомявам Ви, че току-що във ваш сървър бе извършен неуспешен опит за използване на моя команда. ` +
                `Моля, разрешете на StudyBuddy да изпраща и редактира текстови съобщения в съответния канал.` +
                `\n\nНеобходимите разрешения са Изпращане на съобщения (на англ.: Send Messages) и Управление на съобщенията (на англ.: Manage Messages).` +
                `\n\n**Информация за събитието:**` +
                `\n**Сървър:** ${interaction.guild.name}` +
                `\n**Канал:** ${interaction.channel.name}` +
                `\n**Член:** ${interaction.member.user.tag}`
            );
        guildOwner.send({ embeds: [embed] });
        return false;
    }
    return true;
}

module.exports = { hasPermissions };