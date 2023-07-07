// Изискване на нужни класове от discord.js
const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
// Изискване на нужни функции
const { textPagination, imgPagination, videoPagination, audioPagination } = require('../functions/Pagination');
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
        .setName('материали')
        .setDescription('Изпраща всички налични материали по конкретния предмет, клас и вид.')
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
                ))
        .addIntegerOption(grade =>
            grade
                .setName('клас')
                .setDescription('Класът, който си в момента.')
                .setRequired(true)
                .addChoices(
                    { name: '5', value: 5 },
                    { name: '6', value: 6 },
                    { name: '7', value: 7 },
                ))
        .addStringOption(category =>
            category
                .setName('вид')
                .setDescription('Видът учебен материал, който желаеш да прегледаш.')
                .setRequired(true)
                .addChoices(
                    { name: 'текст', value: 'Текст' },
                    { name: 'изображение', value: 'Изображение' },
                    { name: 'видео', value: 'Видеоклип' },
                    { name: 'аудио', value: 'Аудиоклип' }
                )),

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

        // Дефиниране на променливи, които да съдържат въведените аргументи на командата (предмет, клас и вид)
        const subject = interaction.options.getString('предмет');
        const grade = interaction.options.getInteger('клас');
        const type = interaction.options.getString('вид');

        // Дефиниране на променлива, която да съдържа текста на необх. заявка към БД
        const query = `
        SELECT lesson.number, lesson.name, lesson_content.content, lesson_content_type.type, lesson_content.content_description
        FROM lesson_content
        INNER JOIN lesson_content_type ON lesson_content.content_type_id = lesson_content_type.id
        INNER JOIN lesson ON lesson_content.lesson_id = lesson.id
        INNER JOIN subject ON lesson.subject_id = subject.id
        INNER JOIN grade ON subject.grade_id = grade.id
        WHERE subject.name = '${subject}' AND grade.grade = ${grade} AND lesson_content_type.type = '${type}'
        ORDER BY lesson.number ASC, lesson_content.id ASC`;


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

            switch (type) {
                case "Текст": {
                    textPagination(interaction, client, groupedQuery, selectLessonRow, subject, grade);
                    break;
                }
                case "Изображение": {
                    imgPagination(interaction, client, groupedQuery, selectLessonRow, subject, grade);
                    break;
                }
                case "Видеоклип": {
                    videoPagination(interaction, client, groupedQuery, selectLessonRow, subject, grade);
                    break;
                }
                case "Аудиоклип": {
                    audioPagination(interaction, client, groupedQuery, selectLessonRow, subject, grade);
                    break;
                }
                default: { break; }
            };
        });
    },
};