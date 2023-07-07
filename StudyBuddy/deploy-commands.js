// Изискване на environment variables за достъп до токена на бота
require('dotenv').config();
// Изискване на нужни класове от discord.js
const { REST, Routes } = require('discord.js');
// Изискване на модули, необходими за четене на файловете за всяка команда
const fs = require('node:fs');
const path = require('node:path');

const commands = [];

// Обработка на всички команди
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
    try {
        console.log(`Опресняване на ${commands.length} команди.`);

        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.clientId, process.env.devGuildId),
            { body: commands },
        );

        console.log(`${data.length} команди бяха опреснени.`);
    } catch (err) {
        console.error(err);
    }
})();