// Изискване на нужни класове от discord.js
const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
// Изискване на нужни функции
const { hasPermissions } = require('../functions/hasPermissions');

// Създаване на връзка с базата данни
let mysql = require('mysql');
const pool = mysql.createPool({
    connectionLimit: 100,
    host: process.env.host,
    user: process.env.user,
    password: process.env.password,
    database: process.env.db,
    debug: false
});

// Настройки на командата - име, опции, описания, параметри, ...
module.exports = {
    data: new SlashCommandBuilder()
        .setName('уроци')
        .setDescription('Изпраща всички налични материали по конкретния предмет, клас и урок.')
        .setDMPermission(false)
        .addStringOption(subject =>
            subject
                .setName('предмет')
                .setDescription('Учебният предмет, по-който търсиш материали.')
                .setRequired(true)
                .addChoices(
                    { name: 'география и икономика', value: 'География и икономика' },
                    { name: 'история и цивилизации', value: 'История и цивилизации' },
                    { name: 'информационни технологии', value: 'Информационни технологии' },
                )
        )
        .addIntegerOption(grade =>
            grade
                .setName('клас')
                .setDescription('Класът, който си в момента.')
                .setRequired(true)
                .addChoices(
                    { name: '5', value: 5 },
                    { name: '6', value: 6 },
                    { name: '7', value: 7 },
                )
        ),

    // Изпълним код на командата
    async execute(interaction, client) {
        // Ако ботът не разполага със задължителните разрешения се изпраща уведомление към потребителя и собственика на сървъра и се прекратява работа.
        if (!await hasPermissions(interaction)) return;

        // Ако потребителят вече е извикал команда, която все още се изпълнява (има менюта, които чакат избор), ботът извежда съобщение и прекратява работа.
        if (client.cooldowns.has(interaction.user.id)) return interaction.reply({
            content: 'За да изпълниш нова команда, моля първо прекрати предходната, като щракнеш върху бутона "Прекрати командата"',
            ephemeral: true,
        });
        client.cooldowns.add(interaction.user.id);

        // Дефиниране на променливи, които да съдържат въведените аргументи на командата (предмет и клас)
        const subject = interaction.options.getString('предмет');
        const grade = interaction.options.getInteger('клас');

        // Дефиниране на променлива, която да съдържа текста на необх. заявка към БД
        const query = `
        SELECT lesson.number, lesson.name, lesson_content.content, lesson_content_type.type, lesson_content.content_description
        FROM lesson_content
        INNER JOIN lesson_content_type ON lesson_content.content_type_id = lesson_content_type.id
        INNER JOIN lesson ON lesson_content.lesson_id = lesson.id
        INNER JOIN subject ON lesson.subject_id = subject.id
        INNER JOIN grade ON subject.grade_id = grade.id
        WHERE subject.name = '${subject}' AND grade.grade = ${grade}
        ORDER BY lesson_content_type.id ASC, lesson_content.id ASC`;


        //Изпълнение на заявката
        pool.query(query, async (error, queryResult) => {
            // При възникване на грешка при изпълнението на заявката (напр. неуспешна връзка с БД), ботът уведомява потребителите за неспособността си и извежда грешката в конзолата
            if (error) {
                interaction.reply('В момента услугите ми са недостъпни. Моля, опитай по-късно!');
                client.cooldowns.delete(interaction.user.id);
                return console.error(error);
            }

            // При липса на данни в БД, ботът указва това на потребителя чрез съобщение
            if (Object.keys(queryResult).length === 0) {
                interaction.reply('Упс! Не разполагам с никакви материали по зададените от теб критерии. :pensive:\nМоля, опитай с различна комбинация! :relaxed:');
                return client.cooldowns.delete(interaction.user.id);
            }
            // Функция за групиране на масив от обекти по зададен параметър (property)
            function groupBy(arr, property) {
                return arr.reduce(function (memo, x) {
                    if (!memo[x[property]]) { memo[x[property]] = []; }
                    memo[x[property]].push(x);
                    return memo;
                }, {});
            }
            // Групиране на обектите от queryResult по номер на урок (number)
            const groupedQuery = groupBy(queryResult, 'number');

            const selectLesson = new StringSelectMenuBuilder()
                .setCustomId('selectLesson')
                .setPlaceholder('Избери урок от тук')
            for (let i = Object.keys(groupedQuery)[0]; i <= Object.keys(groupedQuery).length; i++) {
                selectLesson.addOptions(
                    {
                        label: `${groupedQuery[i][0].number}. ${groupedQuery[i][0].name}`,
                        value: `${i}`,
                    },
                );
            }
            const selectLessonRow = new ActionRowBuilder().addComponents(selectLesson);

            const initialMessage = await interaction.reply({
                components: [selectLessonRow],
            });

            const selectCollector = await initialMessage.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 15000,
            });

            const btnStopCollector = new ButtonBuilder()
                .setCustomId('stopCol')
                .setLabel('Прекрати командата')
                .setStyle(ButtonStyle.Secondary);

            const buttonRow = new ActionRowBuilder().addComponents(btnStopCollector);

            const btnCollector = await initialMessage.createMessageComponentCollector({
                componentType: ComponentType.Button,
                max: 1,
                time: 15000,
            });

            let imgEmbeds = new Array(); // Масив за съдържание на всички ембеди за изображения
            let selectedLesson; // Избрана лекция
            let textEmbed, videosEmbed, audioEmbed; // Ембеди за текст, видеоклипове и аудиоклипове

            let lastMessage;
            let selectImageRow = new ActionRowBuilder();
            let audioNames, hasVideo;

            btnCollector.on("collect", async (i) => {
                if (i.user.id !== interaction.user.id) {
                    return await i.reply({
                        content: 'Не можеш да натиснеш бутона, защото не ти ме извика!',
                        ephemeral: true,
                    });
                }

                if (initialMessage) await initialMessage.delete();

                await lastMessage.edit({
                    embeds: lastMessage.embeds,
                    components: [],
                });
                selectCollector.stop();
                btnCollector.stop();
            });

            selectCollector.on("collect", async (i) => {
                switch (i.customId) {
                    case 'selectLesson': {
                        if (i.user.id !== interaction.user.id) {
                            return i.reply({
                                content: "Не можеш да избереш урок, защото не ти ме извика!",
                                ephemeral: true,
                            });
                        }

                        selectedLesson = parseInt(i.values[0]);

                        textEmbed = new EmbedBuilder()
                            .setAuthor({ name: `Предмет: ${subject}\nКлас: ${grade}` })
                            .setColor(`${process.env.embedColor}`);
                        videosEmbed = new EmbedBuilder()
                            .setTitle('Видеоклипове')
                            .setColor(`${process.env.embedColor}`);
                        audioEmbed = new EmbedBuilder()
                            .setTitle('Аудиоклипове')
                            .setColor(`${process.env.embedColor}`);

                        let audioIndex = 1, imageIndex = 0;
                        audioNames = ""; hasVideo = false;
                        imgEmbeds = [];

                        const selectImage = new StringSelectMenuBuilder()
                            .setCustomId('selectImg')
                            .setPlaceholder('Избери изображение от тук');

                        // Събиране на информацията за всички налични материали по избрания урок
                        for (let j = 0; j < groupedQuery[selectedLesson].length; j++) {
                            switch (groupedQuery[selectedLesson][j].type) {
                                case 'Текст': {
                                    textEmbed
                                        .setTitle(`${groupedQuery[selectedLesson][0].number}. ${groupedQuery[selectedLesson][0].name}`)
                                        .setDescription(groupedQuery[selectedLesson][0].content);
                                    break;
                                }
                                case 'Изображение': {
                                    const imgEmbed = new EmbedBuilder()
                                        .setImage(`${groupedQuery[selectedLesson][j].content}`)
                                        .setColor(`${process.env.embedColor}`);

                                    if (groupedQuery[selectedLesson][j].content_description !== null) {
                                        imgEmbed.setTitle(`${groupedQuery[selectedLesson][j].content_description}`);
                                        selectImage.addOptions(
                                            {
                                                label: `${groupedQuery[selectedLesson][j].content_description}`,
                                                value: `${imageIndex}`,
                                            },
                                        );
                                    } else {
                                        imgEmbed.setTitle(`Фиг. ${imageIndex + 1}`);
                                        selectImage.addOptions(
                                            {
                                                label: `Фиг. ${imageIndex + 1}`,
                                                value: `${imageIndex}`,
                                            },
                                        );
                                    }
                                    imgEmbeds.push(imgEmbed);
                                    imageIndex++;
                                    break;
                                }
                                case 'Видеоклип': {
                                    videosEmbed
                                        .addFields({ name: groupedQuery[selectedLesson][j].content_description, value: groupedQuery[selectedLesson][j].content, inline: true });
                                    hasVideo = true;
                                    break;
                                }
                                case 'Аудиоклип': {
                                    audioNames = audioNames + `**${audioIndex}.** ${groupedQuery[selectedLesson][j].content_description}\n`;
                                    audioIndex++;
                                    break;
                                }

                                default: { break; }
                            }
                        }
                        selectCollector.options.time = 840000; // Времето в милисекунди, с което потребителят разполага за навигация из уроците/изображенията, преди да трябва да въведе командата отново
                        btnCollector.options.time = 840000;
                        selectCollector.resetTimer();
                        btnCollector.resetTimer();

                        selectImageRow = new ActionRowBuilder().addComponents(selectImage);
                        selectImageRow.components[0].options[0].data.default = true;

                        if (lastMessage) {
                            await lastMessage.delete();
                        }

                        if (hasVideo && audioNames !== "") { // Има видео и аудио
                            audioEmbed
                                .setDescription(`${audioNames}\nЗа възпроизвеждане на аудиоклиповете, моля използвай командата /материали. :blue_heart:`);

                            return lastMessage = await i.reply({
                                embeds: [textEmbed, videosEmbed, audioEmbed, imgEmbeds[0]],
                                components: [selectImageRow, buttonRow],
                            });
                        } else if (!hasVideo && audioNames == "") { // Няма нито видео нито аудио
                            return lastMessage = await i.reply({
                                embeds: [textEmbed, imgEmbeds[0]],
                                components: [selectImageRow, buttonRow],
                            });
                        } else if (hasVideo && audioNames == "") { // Има само видео
                            return lastMessage = await i.reply({
                                embeds: [textEmbed, videosEmbed, imgEmbeds[0]],
                                components: [selectImageRow, buttonRow],
                            });
                        } else {
                            audioEmbed
                                .setDescription(`${audioNames}\nЗа възпроизвеждане на аудиоклиповете, моля използвай командата /материали. :blue_heart:`);

                            return lastMessage = await i.reply({ // Има само аудио
                                embeds: [textEmbed, audioEmbed, imgEmbeds[0]],
                                components: [selectImageRow, buttonRow],
                            });
                        }
                    };
                    case 'selectImg': {
                        if (i.user.id !== interaction.user.id) {
                            return i.reply({
                                content: 'Не можеш да избереш изображение, защото не ти ме извика!',
                                ephemeral: true,
                            });
                        }
                        const selectedImage = parseInt(i.values[0]);

                        for (let i = 0; i < selectImageRow.components[0].options.length; i++) {
                            selectImageRow.components[0].options[i].data.default = false;
                        }
                        selectImageRow.components[0].options[selectedImage].data.default = true;

                        selectCollector.resetTimer();
                        btnCollector.resetTimer();

                        if (hasVideo && audioNames !== "") { // Има видео и аудио
                            audioEmbed
                                .setDescription(`${audioNames}\nЗа възпроизвеждане на аудиоклиповете, моля използвай командата /материали. :blue_heart:`);

                            return await i.update({
                                embeds: [textEmbed, videosEmbed, audioEmbed, imgEmbeds[selectedImage]],
                                components: [selectImageRow, buttonRow],
                            });
                        } else if (!hasVideo && audioNames == "") { // Няма нито видео нито аудио
                            return await i.update({
                                embeds: [textEmbed, imgEmbeds[selectedImage]],
                                components: [selectImageRow, buttonRow],
                            });
                        } else if (hasVideo && audioNames == "") { // Има само видео
                            return await i.update({
                                embeds: [textEmbed, videosEmbed, imgEmbeds[selectedImage]],
                                components: [selectImageRow, buttonRow],
                            });
                        } else {
                            audioEmbed
                                .setDescription(`${audioNames}\nЗа възпроизвеждане на аудиоклипове, моля използвай командата /материали. :blue_heart:`);

                            return await i.update({ // Има само аудио
                                embeds: [textEmbed, audioEmbed, imgEmbeds[selectedImage]],
                                components: [selectImageRow, buttonRow],
                            });
                        }
                    }
                    default: { break; }
                }
            });

            selectCollector.on("end", async (collected, reason) => {
                client.cooldowns.delete(interaction.user.id);
                if (collected.size > 0 && reason == 'time') {
                    await initialMessage.delete();
                    await collected.last().editReply({
                        components: [],
                    });
                    setTimeout(async () => {
                        await collected.last().followUp({
                            content: 'Твоите менюта изчезнаха, поради дълго време на неактивност.',
                            ephemeral: true,
                        });
                    }, 2000);

                } else if (collected.size == 0) {
                    const user = interaction.member.user;
                    await interaction.editReply({
                        content: `${user}, твоето време за избор на урок изтече! Моля, опитай отново.`,
                        components: [],
                    });
                }
            });
            return;
        });
        return;
    },
};