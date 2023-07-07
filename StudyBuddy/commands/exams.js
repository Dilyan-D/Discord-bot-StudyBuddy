// Изискване на нужни класове от discord.js
const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType, ButtonBuilder, ButtonStyle } = require('discord.js');
// Изискване на нужни функции
const { hasPermissions } = require('../functions/hasPermissions');
const { stopCountdown } = require('../functions/stopCountdown');

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
        .setName('тестове')
        .setDescription('Дава възможност за проверка на наученото по конкретен предмет от конкретен клас.')
        .setDMPermission(false)
        .addStringOption(subject =>
            subject
                .setName('предмет')
                .setDescription('Учебният предмет, по-който искаш да бъдеш изпитан.')
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

        // Дефиниране на променлива, която да съдържа текста на необх. заявка към БД
        const query = `
        SELECT exam.id, question_answer.question_id, question.question, answer.answer, question_answer.is_correct
        FROM exam_question_answer
        INNER JOIN question_answer ON exam_question_answer.qa_id = question_answer.id
        INNER JOIN exam ON exam_question_answer.exam_id = exam.id
        INNER JOIN question ON question_answer.question_id = question.id
        INNER JOIN answer ON question_answer.answer_id = answer.id
        INNER JOIN subject ON exam.subject_id = subject.id
        INNER JOIN grade ON subject.grade_id = grade.id
        WHERE subject.name = '${subject}' AND grade.grade = ${grade}
        ORDER BY question_answer.question_id ASC`;

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
            // Групиране на обектите от queryResult по id на тест; получава се масив, при който всеки елемент е обект от тест
            const initGroupedQuery = groupBy(queryResult, 'id');

            const selectTest = new StringSelectMenuBuilder()
                .setCustomId('selectTest')
                .setPlaceholder('Избери тест от тук')

            // Групиране на обектите от initGroupedQuery по question_id; получава се масив, при който всеки елемент е обект от въпрос от съответния тест
            let groupedQuery = new Array();
            for (let i = Object.keys(initGroupedQuery)[0]; i <= Object.keys(initGroupedQuery).length; i++) {
                const group = groupBy(initGroupedQuery[i], 'question_id');
                groupedQuery.push(group);

                selectTest.addOptions(
                    {
                        label: `Тест № ${i}`,
                        value: `${i}`,
                    },
                );
            }

            const selectTestRow = new ActionRowBuilder().addComponents(selectTest);

            const initialMessage = await interaction.reply({
                components: [selectTestRow],
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

            const testStartingTime = 30000; // Времето в милисекунди, след което ще се стартира теста
            const timePerQuestion = 120000; // Времето в милисекунди, заделено за отговор на 1 въпрос от теста
            let testDuration = 0; // Времетраене на тест в милисекунди; определя се след направен от потребителя избор на тест
            let questionsAmount = 0; // Брой въпроси от избрания тест
            let selectedTest, selectedQuestion = 0; // Стойността, отговаряща на избрания тест/въпрос от менютата
            let qaData = new Array(); // Масив, съдържащ всички обекти, всеки от които съдържа ембед и двата компонента (менютата за избор на въпрос и отговор) за всеки въпрос
            let scoredPoints = 0; // Събрани точки от верни отговори на въпроси от тест
            let answeredQuestions = 0, correctQuestions = 0; // Брой отговорени въпроси и брой отговорени правилно въпроси
            const pointsPerAnswer = 1; // Определя колко точки се дават за правилен отговор; влияе на крайната оценка
            const answerLetters = ['а', 'б', 'в', 'г', 'д', 'е', 'ж', 'з']; // Възможни отговори; предполага се, че няма да има повече от 8 отговора на въпрос

            let testDurationInterval, timeLeftMessage, difference = 0;

            btnCollector.on("collect", async (i) => {
                if (i.user.id !== interaction.user.id) {
                    return await i.reply({
                        content: 'Не можеш да натиснеш бутона, защото не ти ме извика!',
                        ephemeral: true,
                    });
                }

                await initialMessage.edit({
                    embeds: [qaData[selectedQuestion].embed],
                    components: [],
                });
                if (testDurationInterval) stopCountdown(testDurationInterval, timeLeftMessage); // Спиране на брояча на оставащо време от теста
                selectCollector.stop();
                btnCollector.stop();
            });

            selectCollector.on("collect", async (i) => {
                switch (i.customId) {
                    case 'selectTest': { // Изпълнява се при избор на тест от менюто
                        if (i.user.id !== interaction.user.id) {
                            return i.reply({
                                content: "Не можеш да избереш тест, защото не ти ме извика!",
                                ephemeral: true,
                            });
                        }

                        selectedTest = parseInt(i.values[0]) - 1;
                        questionsAmount = Object.keys(groupedQuery[selectedTest]).length;

                        testDuration = questionsAmount * timePerQuestion; // Определяне времетраенето на теста според броя на въпроси и времето за отговор на въпрос

                        const minutes = Math.floor((testDuration % (1000 * 60 * 60)) / (1000 * 60));
                        const seconds = Math.ceil((testDuration % (1000 * 60)) / 1000);

                        const initialEmbed = new EmbedBuilder()
                            .setDescription(
                                `**Предмет:** ${subject}\n**Клас:** ${grade}` +
                                `\n**Брой въпроси:** ${questionsAmount}` +
                                `\n**Времетраене:** ${minutes} мин. и ${seconds} сек.` +
                                `\n\nСъвет: Имай предвид, че ще можеш да избереш отговор само веднъж - избирай внимателно!`
                            )
                            .setTitle(`Тест № ${selectedTest + 1} ще стартира след ${testStartingTime / 1000} секунди...`)
                            .setColor(`${process.env.embedColor}`);


                        const selectQuestion = new StringSelectMenuBuilder()
                            .setCustomId('selectQuestion')
                            .setPlaceholder('Избери въпрос от тук');

                        let questionIndex = 0; // За индикация на индекс в qaData при interaction със selectQuestion 

                        // Събиране на информацията за всички налични въпроси и отговори по избрания тест
                        // За всeки въпрос
                        for (let j = Object.keys(groupedQuery[selectedTest])[0]; j <= Object.keys(groupedQuery[selectedTest]).length; j++) {
                            const questionName = `${j}. ${groupedQuery[selectedTest][j][0].question}`;
                            const emoji = '❌';
                            const selectedAnswerText = 'N/A';
                            let correctAnswerText = "";

                            const embed = new EmbedBuilder()
                                .setTitle(`${questionName}`)
                                .setColor(`${process.env.embedColor}`);

                            const selectAnswer = new StringSelectMenuBuilder()
                                .setCustomId('selectAnswer')
                                .setPlaceholder('Избери отговор от тук');

                            selectQuestion.addOptions(
                                {
                                    label: `${questionName}`,
                                    value: `${questionIndex}`,
                                },
                            );
                            questionIndex++;

                            const selectQuestionRow = new ActionRowBuilder().addComponents(selectQuestion);

                            let answerNames = new Array();
                            // За всеки отговор от 1 въпрос
                            for (let n = 0; n < groupedQuery[selectedTest][j].length; n++) {
                                answerNames.push(`**${answerLetters[n]})** ${groupedQuery[selectedTest][j][n].answer}`);
                                selectAnswer.addOptions(
                                    {
                                        label: `${answerLetters[n]})`,
                                        value: `${j}\t${n}`,
                                    },
                                );
                                if (groupedQuery[selectedTest][j][n].is_correct == 1) {
                                    correctAnswerText = `${answerLetters[n]}) ${groupedQuery[selectedTest][j][n].answer}`;
                                }
                            }
                            const selectAnswerRow = new ActionRowBuilder().addComponents(selectAnswer);
                            embed.setDescription(answerNames.join('\n'));

                            const examResultsData = { questionName, emoji, selectedAnswerText, correctAnswerText };
                            qaData.push({ embed, selectQuestionRow, selectAnswerRow, examResultsData });
                        }
                        qaData[0].selectQuestionRow.components[0].options[0].data.default = true;

                        await i.update({
                            embeds: [initialEmbed],
                            components: [],
                        });
                        let tmpTestStartingTime = testStartingTime;
                        const testStartDate = new Date().getTime() + testStartingTime;

                        const testStartInterval = setInterval(async () => { // Начало на отброяване до начало на тест
                            selectCollector.resetTimer();
                            btnCollector.resetTimer();

                            const now = new Date().getTime();
                            const diff = testStartDate - now;

                            if (diff <= 0) { // Времето е изтекло, т.е. тестът започва
                                clearInterval(testStartInterval);

                                await i.editReply({ // Визуализиране на първия въпрос
                                    embeds: [qaData[0].embed],
                                    components: [qaData[0].selectQuestionRow, qaData[0].selectAnswerRow, buttonRow],
                                });

                                timeLeftMessage = await i.followUp({
                                    content: `Време за изпълнение на теста: ${minutes} мин. ${seconds} сек.`,
                                });

                                selectCollector.options.time = testDuration; // Удължаване времетраенето на колектора според времетраенето на теста
                                btnCollector.options.time = testDuration;
                                selectCollector.resetTimer();
                                btnCollector.resetTimer();

                                const testEndDate = new Date().getTime() + testDuration;
                                testDurationInterval = setInterval(async () => { // Начало на брояч на оставащо време от теста
                                    const now = new Date().getTime();
                                    difference = testEndDate - now;

                                    if (difference <= 0) { // Времето е изтекло, т.е. тестът е приключил
                                        return;
                                    }
                                    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
                                    const seconds = Math.ceil((difference % (1000 * 60)) / 1000);


                                    await timeLeftMessage.edit({
                                        content: `Време за изпълнение на теста: ${minutes} мин. ${seconds} сек.`,
                                    });

                                }, 1000);

                                return;
                            }
                            tmpTestStartingTime = tmpTestStartingTime - 1000; // Обновяване на времето за стартиране на тест, така че да е със секунда по-кратко

                            initialEmbed.setTitle(`Тест № ${selectedTest + 1} ще стартира след ${tmpTestStartingTime / 1000} секунди...`);
                            await i.editReply({
                                embeds: [initialEmbed],
                            });

                        }, 1000);

                        break;
                    }
                    case 'selectQuestion': { // Изпълнява се при избор на въпрос от менюто
                        if (i.user.id !== interaction.user.id) {
                            return i.reply({
                                content: 'Не можеш да избереш въпрос, защото не ти ме извика!',
                                ephemeral: true,
                            });
                        }
                        selectedQuestion = parseInt(i.values[0]);

                        for (let i = 0; i < qaData[selectedQuestion].selectQuestionRow.components[0].options.length; i++) {
                            qaData[selectedQuestion].selectQuestionRow.components[0].options[i].data.default = false;
                        }
                        qaData[selectedQuestion].selectQuestionRow.components[0].options[selectedQuestion].data.default = true;

                        await i.update({
                            embeds: [qaData[selectedQuestion].embed],
                            components: [qaData[selectedQuestion].selectQuestionRow, qaData[selectedQuestion].selectAnswerRow, buttonRow],
                        });

                        break;
                    }
                    case 'selectAnswer': { // Изпълнява се при избор на отговор от менюто
                        if (i.user.id !== interaction.user.id) {
                            return i.reply({
                                content: 'Не можеш да избереш отговор, защото не ти ме извика!',
                                ephemeral: true,
                            });
                        }
                        const inputData = i.values[0].split('\t');
                        const questionNumber = inputData[0];
                        const selectedAnswer = inputData[1];

                        answeredQuestions = answeredQuestions + 1;
                        qaData[selectedQuestion].examResultsData.selectedAnswerText = `${answerLetters[selectedAnswer]}) ${groupedQuery[selectedTest][questionNumber][selectedAnswer].answer}`;

                        if (groupedQuery[selectedTest][questionNumber][selectedAnswer].is_correct == 1) { // Ако избраният отговор е верен
                            scoredPoints = scoredPoints + pointsPerAnswer; // Добавяне на точка/точки при верен отговор
                            correctQuestions = correctQuestions + 1; // Увеличаване броя на вярно отговорени въпроси с 1
                            qaData[selectedQuestion].examResultsData.emoji = '✅';
                        }

                        if (answeredQuestions == questionsAmount) { // Всички въпроси са били отговорени
                            if (testDurationInterval) stopCountdown(testDurationInterval, timeLeftMessage); // Спиране на брояча на оставащо време от теста

                            const testTimeElapsed = testDuration - difference;
                            const minutes = Math.floor((testTimeElapsed % (1000 * 60 * 60)) / (1000 * 60));
                            const seconds = Math.ceil((testTimeElapsed % (1000 * 60)) / 1000);

                            const maxPoints = questionsAmount * pointsPerAnswer;
                            let examResult = (scoredPoints / maxPoints) * 6;
                            const username = interaction.member.user.username;

                            examResult = Math.round(examResult * 100) / 100; // Форматиране на числото до 2 знака след десетичната запетая
                            if (examResult < 3.00) examResult = 2.00;

                            const embed = new EmbedBuilder()
                                .setAuthor({ name: `Предмет: ${subject}   Клас: ${grade}` })
                                .setTitle(`ТЕСТ № ${selectedTest + 1} — РЕЗУЛТАТИ`)
                                .setColor(`${process.env.embedColor}`);

                            let examReview = "";
                            qaData.forEach(item => {
                                examReview +=
                                    `**${item.examResultsData.questionName}**   ${item.examResultsData.emoji}` +
                                    `\nПосочен отговор: ${item.examResultsData.selectedAnswerText}` +
                                    `\nПравилен отговор: ${item.examResultsData.correctAnswerText}\n\n`;
                            });

                            if (examResult >= 5.50) {
                                embed.setDescription(
                                    `**Поздравления, ${username}! Ти изкара отлична оценка!**` +
                                    `\n\nТвоята оценка е: Отличен ${examResult}` +
                                    `\nУспя да отговориш правилно на ${correctQuestions} от ${answeredQuestions} отговорени въпроса от общо ${questionsAmount}.` +
                                    `\nИзпълнението на теста ти отне ${minutes} минути и ${seconds} секунди.` +
                                    `\n\n\n\n${examReview}`
                                );
                                embed.setColor('DarkGreen');
                            }
                            else if (examResult >= 4.50 && examResult < 5.50) {
                                embed.setDescription(
                                    `**Браво на теб, ${username}! Ти изкара много добра оценка!**` +
                                    `\n\nТвоята оценка е: Много добър ${examResult}` +
                                    `\nУспя да отговориш правилно на ${correctQuestions} от ${answeredQuestions} отговорени въпроса от общо ${questionsAmount}.` +
                                    `\nИзпълнението на теста ти отне ${minutes} минути и ${seconds} секунди.` +
                                    `\n\n\n\n${examReview}`
                                );
                                embed.setColor('Green');
                            }
                            else if (examResult >= 3.50 && examResult < 4.50) {
                                embed.setDescription(
                                    `**${username}, знам, че можеш и повече!**` +
                                    `\n\nТвоята оценка е: Добър ${examResult}` +
                                    `\nУспя да отговориш правилно на ${correctQuestions} от ${answeredQuestions} отговорени въпроса от общо ${questionsAmount}.` +
                                    `\nИзпълнението на теста ти отне ${minutes} минути и ${seconds} секунди.` +
                                    `\n\n\n\n${examReview}`
                                );
                                embed.setColor('Yellow');
                            }
                            else if (examResult >= 3.0 && examResult < 3.50) {
                                embed.setDescription(
                                    `**О, не! Ти изкара средна оценка!**` +
                                    `\n\nТвоята оценка е: Среден ${examResult}` +
                                    `\nУспя да отговориш правилно на ${correctQuestions} от ${answeredQuestions} отговорени въпроса от общо ${questionsAmount}.` +
                                    `\nИзпълнението на теста ти отне ${minutes} минути и ${seconds} секунди.` +
                                    `\n\n\n\n${examReview}`
                                );
                                embed.setColor('Orange');
                            }
                            else {
                                embed.setDescription(
                                    `**Много лошо, ${username}! Ще трябва да учиш по-усърдно за следващия път!**` +
                                    `\n\nТвоята оценка е: Слаб ${examResult}` +
                                    `\nУспя да отговориш правилно на ${correctQuestions} от ${answeredQuestions} отговорени въпроса от общо ${questionsAmount}.` +
                                    `\nИзпълнението на теста ти отне ${minutes} минути и ${seconds} секунди.` +
                                    `\n\n\n\n${examReview}`
                                );
                                embed.setColor('Red');
                            }
                            await i.update({
                                embeds: [embed],
                                components: [],
                            });

                            selectCollector.stop(); // Стопиране на колектора (ботът повече няма да очаква отговор от потребителя)
                            btnCollector.stop();
                            break;
                        }

                        for (let i = 0; i < qaData[selectedQuestion].selectAnswerRow.components[0].options.length; i++) {
                            qaData[selectedQuestion].selectAnswerRow.components[0].options[i].data.default = false;
                        }
                        qaData[selectedQuestion].selectAnswerRow.components[0].options[selectedAnswer].data.default = true;
                        qaData[selectedQuestion].selectAnswerRow.components[0].setDisabled(true);

                        await i.update({
                            embeds: [qaData[selectedQuestion].embed],
                            components: [qaData[selectedQuestion].selectQuestionRow, qaData[selectedQuestion].selectAnswerRow, buttonRow],
                        });
                        break;
                    }
                    default: { break; }
                }
            });

            selectCollector.on("end", async (collected, reason) => {
                client.cooldowns.delete(interaction.user.id);

                if (collected.size > 0 && reason == 'time') {
                    if (testDurationInterval) stopCountdown(testDurationInterval, timeLeftMessage); // Спиране на брояча на оставащо време от теста

                    const testTimeElapsed = testDuration - difference;
                    const minutes = Math.floor((testTimeElapsed % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.ceil((testTimeElapsed % (1000 * 60)) / 1000);

                    const maxPoints = questionsAmount * pointsPerAnswer;
                    let examResult = (scoredPoints / maxPoints) * 6;
                    const username = interaction.member.user.username;

                    if (examResult < 3.00) examResult = 2.00;
                    examResult = Math.round(examResult * 100) / 100; // Форматиране на числото до 2 знака след десетичната запетая

                    const embed = new EmbedBuilder()
                        .setAuthor({ name: `Предмет: ${subject}   Клас: ${grade}` })
                        .setTitle(`ТЕСТ № ${selectedTest + 1} — РЕЗУЛТАТИ`);


                    let examReview = "";
                    qaData.forEach(item => {
                        examReview +=
                            `**${item.examResultsData.questionName}**   ${item.examResultsData.emoji}` +
                            `\nПосочен отговор: ${item.examResultsData.selectedAnswerText}` +
                            `\nПравилен отговор: ${item.examResultsData.correctAnswerText}\n\n`;
                    });

                    if (examResult >= 5.50) {
                        embed
                            .setDescription(
                                `**${username}, твоето време за попълване на теста свърши!**` +
                                `\n\nТвоята оценка е: Отличен ${examResult}` +
                                `\nУспя да отговориш правилно на ${correctQuestions} от ${answeredQuestions} отговорени въпроса от общо ${questionsAmount}.` +
                                `\nИзпълнението на теста ти отне ${minutes} минути и ${seconds} секунди.` +
                                `\n\n\n\n${examReview}`
                            )
                            .setColor('DarkGreen');
                    }
                    else if (examResult >= 4.50 && examResult < 5.50) {
                        embed
                            .setDescription(
                                `**${username}, твоето време за попълване на теста свърши!**` +
                                `\n\nТвоята оценка е: Много добър ${examResult}` +
                                `\nУспя да отговориш правилно на ${correctQuestions} от ${answeredQuestions} отговорени въпроса от общо ${questionsAmount}.` +
                                `\nИзпълнението на теста ти отне ${minutes} минути и ${seconds} секунди.` +
                                `\n\n\n\n${examReview}`
                            )
                            .setColor('Green');
                    }
                    else if (examResult >= 3.50 && examResult < 4.50) {
                        embed
                            .setDescription(
                                `**${username}, твоето време за попълване на теста свърши!**` +
                                `\n\nТвоята оценка е: Добър ${examResult}` +
                                `\nУспя да отговориш правилно на ${correctQuestions} от ${answeredQuestions} отговорени въпроса от общо ${questionsAmount}.` +
                                `\nИзпълнението на теста ти отне ${minutes} минути и ${seconds} секунди.` +
                                `\n\n\n\n${examReview}`
                            )
                            .setColor('Yellow');
                    }
                    else if (examResult >= 3.0 && examResult < 3.50) {
                        embed
                            .setDescription(
                                `**${username}, твоето време за попълване на теста свърши!**` +
                                `\n\nТвоята оценка е: Среден ${examResult}` +
                                `\nУспя да отговориш правилно на ${correctQuestions} от ${answeredQuestions} отговорени въпроса от общо ${questionsAmount}.` +
                                `\nИзпълнението на теста ти отне ${minutes} минути и ${seconds} секунди.` +
                                `\n\n\n\n${examReview}`
                            )
                            .setColor('Orange');
                    }
                    else {
                        embed
                            .setDescription(
                                `**${username}, твоето време за попълване на теста свърши!**` +
                                `\n\nТвоята оценка е: Слаб ${examResult}` +
                                `\nУспя да отговориш правилно на ${correctQuestions} от ${answeredQuestions} отговорени въпроса от общо ${questionsAmount}.` +
                                `\nИзпълнението на теста ти отне ${minutes} минути и ${seconds} секунди.` +
                                `\n\n\n\n${examReview}`
                            )
                            .setColor('Red');
                    }

                    await collected.last().editReply({
                        embeds: [embed],
                        components: [],
                    });

                } else if (collected.size == 0) {
                    const user = interaction.member.user;
                    await interaction.editReply({
                        content: `${user}, твоето време за избор на тест изтече! Моля, опитай отново.`,
                        components: [],
                    });
                }
            });
            return;
        });
        return;
    },
};