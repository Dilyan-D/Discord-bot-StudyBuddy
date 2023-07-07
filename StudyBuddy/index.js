// Зареждане на environment variables в приложението
require('dotenv').config();
// Изискване на нужни класове от discord.js
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
// Изискване на модули, необходими за четене на файловете за всяка команда
const fs = require('node:fs');
const path = require('node:path');
// Създаване на обект от клас Client
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates] });
client.commands = new Collection();
// Създаване на колекция, която ще съдържа ID номерата на потребителите, които изпълняват дадена команда
client.cooldowns = new Set();

// Изпращане на потвърждение в терминала при успешно стартиране на бота
client.once(Events.ClientReady, () => {
    console.log('Ботът бе стартиран успешно.');
});

// Обработка на всички команди
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[ПРЕДУПРЕЖДЕНИЕ] Липсва свойство 'data' или 'execute' в следната команда: ${filePath}`);
    }
}

// Listener за команди
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return; // Ако възникналият interaction не е команден, събитието се пропуска

    const command = interaction.client.commands.get(interaction.commandName);

    // Ако командата не съществува се извежда грешка в терминала и събитието се пропуска
    if (!command) {
        console.error(`Командата '${interaction.commandName}' не съществува.`);
        return;
    }

    try {
        // Изпълнение на командата
        await command.execute(interaction, client);
    } catch (err) {
        // Извеждане на грешката в терминала при възникване на такава и уведомяване на потребителя, въвел командата
        console.error(err);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Възникна грешка при изпълнението на тази команда. Моля, опитай отново!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Възникна грешка при изпълнението на тази команда. Моля, опитай отново!', ephemeral: true });
        }
    }
});

// Логване на бота в Дискорд
client.login(process.env.BOT_TOKEN);