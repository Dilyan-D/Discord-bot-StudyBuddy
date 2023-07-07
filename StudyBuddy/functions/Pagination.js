// Изискване на нужни класове от discord.js
const { ActionRowBuilder, ComponentType, EmbedBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } = require('@discordjs/voice');


async function textPagination(interaction, client, groupedQuery, selectLessonRow, subject, grade, time = 840000) {

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

    const embed = new EmbedBuilder()
        .setAuthor({ name: `Предмет: ${subject}\nКлас: ${grade}` })
        .setColor(`${process.env.embedColor}`);

    btnCollector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
            return await i.reply({
                content: 'Не можеш да натиснеш бутона, защото не ти ме извика!',
                ephemeral: true,
            });
        }

        await initialMessage.edit({
            embeds: [embed],
            components: [],
        });
        selectCollector.stop();
        btnCollector.stop();
    });

    selectCollector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
            return i.reply({
                content: "Не можеш да избереш урок, защото не ти ме извика!",
                ephemeral: true,
            });
        }
        const selectedLesson = parseInt(i.values[0]);

        for (let i = 0; i < selectLessonRow.components[0].options.length; i++) {
            selectLessonRow.components[0].options[i].data.default = false;
        }
        selectLessonRow.components[0].options[selectedLesson - 1].data.default = true;

        embed
            .setTitle(`${groupedQuery[selectedLesson][0].number}. ${groupedQuery[selectedLesson][0].name}`)
            .setDescription(groupedQuery[selectedLesson][0].content);

        await i.update({
            embeds: [embed],
            components: [selectLessonRow, buttonRow],
        });
        selectCollector.options.time = time;
        btnCollector.options.time = time;
        selectCollector.resetTimer();
        btnCollector.resetTimer();
    });

    selectCollector.on("end", async (collected, reason) => {
        client.cooldowns.delete(interaction.user.id);
        if (collected.size > 0 && reason == 'time') {
            await collected.last().editReply({
                embeds: [embed],
                components: [],
            });
            setTimeout(async () => {
                await collected.last().followUp({
                    content: 'Твоето меню изчезна, поради дълго време на неактивност.',
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
}

async function imgPagination(interaction, client, groupedQuery, selectLessonRow, subject, grade, time = 60000) {

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

    const embed = new EmbedBuilder()
        .setAuthor({ name: `Предмет: ${subject}\nКлас: ${grade}` })
        .setColor(`${process.env.embedColor}`);

    let selectImageRow = new ActionRowBuilder();
    let selectedLesson;

    btnCollector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
            return await i.reply({
                content: 'Не можеш да натиснеш бутона, защото не ти ме извика!',
                ephemeral: true,
            });
        }

        await initialMessage.edit({
            embeds: [embed],
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
                        content: 'Не можеш да избереш урок, защото не ти ме извика!',
                        ephemeral: true,
                    });
                }
                selectedLesson = parseInt(i.values[0]);

                for (let i = 0; i < selectLessonRow.components[0].options.length; i++) {
                    selectLessonRow.components[0].options[i].data.default = false;
                }
                selectLessonRow.components[0].options[selectedLesson - 1].data.default = true;

                embed
                    .setTitle(`${groupedQuery[selectedLesson][0].content_description}`)
                    .setImage(`${groupedQuery[selectedLesson][0].content}`);

                const selectImage = new StringSelectMenuBuilder()
                    .setCustomId('selectImage')
                    .setPlaceholder('Избери изображение от тук');

                for (let j = 0; j < groupedQuery[selectedLesson].length; j++) {
                    if (groupedQuery[selectedLesson][j].content_description !== null) {
                        selectImage.addOptions(
                            {
                                label: `${groupedQuery[selectedLesson][j].content_description}`,
                                value: `${j}`,
                            },
                        );
                    } else {
                        selectImage.addOptions(
                            {
                                label: `Фиг. ${j + 1}`,
                                value: `${j}`,
                            },
                        );
                    }

                };
                selectImageRow = new ActionRowBuilder().addComponents(selectImage);
                selectImageRow.components[0].options[0].data.default = true;

                await i.update({
                    embeds: [embed],
                    components: [selectLessonRow, selectImageRow, buttonRow],
                });

                selectCollector.options.time = time;
                btnCollector.options.time = time;
                selectCollector.resetTimer();
                btnCollector.resetTimer();
                break;
            }
            case 'selectImage': {

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

                if (groupedQuery[selectedLesson][selectedImage].content_description !== null) {
                    embed.setTitle(`${groupedQuery[selectedLesson][selectedImage].content_description}`);
                } else {
                    embed.setTitle(`Фиг. ${selectedImage + 1}`);
                }

                embed.setImage(`${groupedQuery[selectedLesson][selectedImage].content}`);

                await i.update({
                    embeds: [embed],
                    components: [selectLessonRow, selectImageRow, buttonRow],
                });

                selectCollector.resetTimer();
                btnCollector.resetTimer();
                break;
            }
            default: { break; }
        }
    });

    selectCollector.on("end", async (collected, reason) => {
        client.cooldowns.delete(interaction.user.id);
        if (collected.size > 0 && reason == 'time') {
            await collected.last().editReply({
                embeds: [embed],
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

}

async function videoPagination(interaction, client, groupedQuery, selectLessonRow, subject, grade, time = 60000) {

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

    let embed = new EmbedBuilder();

    btnCollector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
            return await i.reply({
                content: 'Не можеш да натиснеш бутона, защото не ти ме извика!',
                ephemeral: true,
            });
        }

        await initialMessage.edit({
            embeds: [embed],
            components: [],
        });
        selectCollector.stop();
        btnCollector.stop();
    });

    selectCollector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
            return i.reply({
                content: 'Не можеш да избереш урок, защото не ти ме извика!',
                ephemeral: true,
            });
        }
        const selectedLesson = parseInt(i.values[0]);

        for (let i = 0; i < selectLessonRow.components[0].options.length; i++) {
            selectLessonRow.components[0].options[i].data.default = false;
        }
        selectLessonRow.components[0].options[selectedLesson - 1].data.default = true;

        embed = new EmbedBuilder()
            .setAuthor({ name: `Предмет: ${subject}\nКлас: ${grade}` })
            .setTitle('Видеоклипове')
            .setColor(`${process.env.embedColor}`);

        for (let j = 0; j < groupedQuery[selectedLesson].length; j++) {
            embed.addFields({ name: groupedQuery[selectedLesson][j].content_description, value: groupedQuery[selectedLesson][j].content, inline: true });
        }

        await i.update({
            embeds: [embed],
            components: [selectLessonRow, buttonRow],
        });
        selectCollector.options.time = time;
        btnCollector.options.time = time;
        selectCollector.resetTimer();
        btnCollector.resetTimer();
    });

    selectCollector.on("end", async (collected, reason) => {
        client.cooldowns.delete(interaction.user.id);
        if (collected.size > 0 && reason == 'time') {
            await collected.last().editReply({
                embeds: [embed],
                components: [],
            });
            setTimeout(async () => {
                await collected.last().followUp({
                    content: 'Твоето меню изчезна, поради дълго време на неактивност.',
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
}

async function audioPagination(interaction, client, groupedQuery, selectLessonRow, subject, grade, time = 60000) {

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

    const colButtonRow = new ActionRowBuilder().addComponents(btnStopCollector);

    const btnCollector = await initialMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 15000,
    });

    const btnStop = new ButtonBuilder()
        .setCustomId('stop')
        .setEmoji('⏹️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);

    const buttonRow = new ActionRowBuilder().addComponents(btnStop);

    const embed = new EmbedBuilder()
        .setAuthor({ name: `Предмет: ${subject}\nКлас: ${grade}` })
        .setTitle('Аудиоклипове')
        .setColor(`${process.env.embedColor}`);

    let selectAudioRow = new ActionRowBuilder(), selectedAudio = 0;
    let selectedLesson;
    let timeout;
    let audioPlayer, voiceConnection;
    let cmdStopped = false;

    btnCollector.on("collect", async (i) => {
        switch (i.customId) {
            case 'stopCol': {
                if (i.user.id !== interaction.user.id) {
                    return await i.reply({
                        content: 'Не можеш да натиснеш бутона, защото не ти ме извика!',
                        ephemeral: true,
                    });
                }

                await initialMessage.edit({
                    embeds: [embed],
                    components: [],
                });
                cmdStopped = true;
                clearTimeout(timeout);
                if (audioPlayer) audioPlayer.stop();
                if (voiceConnection) voiceConnection.destroy();
                selectCollector.stop();
                btnCollector.stop();
                return;
            }
            case 'stop': {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({
                        content: 'Не можеш да използваш този бутон, защото не ти ме извика!',
                        ephemeral: true,
                    });
                }
                if (audioPlayer) audioPlayer.stop();
                setTimeout(async () => {
                    await initialMessage.edit({
                        embeds: [embed],
                        components: [buttonRow, selectLessonRow, selectAudioRow, colButtonRow],
                    });
                    // await interaction.followUp({
                    //     content: `Спирам възпроизвеждането на аудиофайл '${groupedQuery[selectedLesson][selectedAudio].content_description}'.`,
                    //     ephemeral: true,
                    // });
                }, 200);
                selectAudioRow.components[0].options[selectedAudio].data.default = false;
                selectCollector.resetTimer();
                await i.deferUpdate();

                break;
            }
            default: { break; }
        }

    });

    selectCollector.on("collect", async (i) => {
        switch (i.customId) {
            case 'selectLesson': {

                if (i.user.id !== interaction.user.id) {
                    return i.reply({
                        content: 'Не можеш да избереш урок, защото не ти ме извика!',
                        ephemeral: true,
                    });
                }
                selectedLesson = parseInt(i.values[0]);

                for (let i = 0; i < selectLessonRow.components[0].options.length; i++) {
                    selectLessonRow.components[0].options[i].data.default = false;
                }
                selectLessonRow.components[0].options[selectedLesson - 1].data.default = true;

                let audioNames = new Array();

                const selectAudio = new StringSelectMenuBuilder()
                    .setCustomId('selectAudio')
                    .setPlaceholder('Избери аудиофайл от тук')

                for (let j = 0; j < groupedQuery[selectedLesson].length; j++) {
                    audioNames.push(`**${j + 1}.** ${groupedQuery[selectedLesson][j].content_description}`);

                    selectAudio.addOptions(
                        {
                            label: `${j + 1}. ${groupedQuery[selectedLesson][j].content_description}`,
                            value: `${j}`,
                        },
                    );
                }
                selectAudioRow = new ActionRowBuilder().addComponents(selectAudio);
                embed.setDescription(audioNames.join("\n"));

                await i.update({
                    embeds: [embed],
                    components: [buttonRow, selectLessonRow, selectAudioRow, colButtonRow],
                });

                selectCollector.options.time = time;
                btnCollector.options.time = time;
                selectCollector.resetTimer();
                btnCollector.resetTimer();
                break;
            }
            case 'selectAudio': {

                if (i.user.id !== interaction.user.id) {
                    return i.reply({
                        content: 'Не можеш да избереш аудиоклип, защото не ти ме извика!',
                        ephemeral: true,
                    });
                }

                if (!interaction.member.voice.channel) {
                    const user = interaction.member.user;
                    await i.update({
                        embeds: [embed],
                        components: [selectLessonRow, selectAudioRow, colButtonRow],
                    });
                    await i.followUp({
                        content: `${user}, за възпроизвеждане на аудиото е необходимо първо да бъдеш в гласови канал!`,
                        ephemeral: true,
                    });
                    selectCollector.resetTimer();
                    return;
                }
                selectedAudio = parseInt(i.values[0]);

                for (let i = 0; i < selectAudioRow.components[0].options.length; i++) {
                    selectAudioRow.components[0].options[i].data.default = false;
                }
                selectAudioRow.components[0].options[selectedAudio].data.default = true;

                voiceConnection = joinVoiceChannel({
                    channelId: interaction.member.voice.channelId,
                    guildId: interaction.member.voice.channel.guildId,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                });

                audioPlayer = createAudioPlayer();
                const audioResource = createAudioResource(groupedQuery[selectedLesson][selectedAudio].content, {
                    inputType: StreamType.OggOpus,
                });
                audioPlayer.stop();
                clearTimeout(timeout);

                await i.update({
                    embeds: [embed],
                    components: [buttonRow, selectLessonRow, selectAudioRow, colButtonRow],
                });

                audioPlayer.on(AudioPlayerStatus.Playing, async () => {
                    btnStop.setDisabled(false);
                    clearTimeout(timeout);
                    
                    await i.editReply({
                        embeds: [embed],
                        components: [buttonRow, selectLessonRow, selectAudioRow, colButtonRow],
                    });
                });


                const initialTime = time;
                selectCollector.options.time = 60000000;
                selectCollector.resetTimer();
                btnCollector.options.time = 60000000;
                btnCollector.resetTimer();

                audioPlayer.on(AudioPlayerStatus.Idle, async () => {
                    btnStop.setDisabled(true);
                    if (!cmdStopped) {
                        await i.editReply({
                            embeds: [embed],
                            components: [buttonRow, selectLessonRow, selectAudioRow, colButtonRow],
                        });

                        await interaction.followUp({
                            content: `Спирам възпроизвеждането на аудиофайл '${groupedQuery[selectedLesson][selectedAudio].content_description}'.`,
                            ephemeral: true,
                        });

                        selectCollector.options.time = initialTime;
                        selectCollector.resetTimer();
                        btnCollector.options.time = initialTime;
                        btnCollector.resetTimer();

                        timeout = setTimeout(() => {
                            i.followUp({
                                content: 'Изминаха 30 секунди, откакто възпроизведох аудиоклип - напускам гласовия канал...',
                            });
                            audioPlayer.stop();
                            voiceConnection.destroy();
                        }, "30000");
                    }
                });

                audioPlayer.play(audioResource);
                voiceConnection.subscribe(audioPlayer);

                // await i.followUp({
                //     content: `Започвам възпроизвеждане на аудиофайл '${groupedQuery[selectedLesson][selectedAudio].content_description}'.`,
                //     ephemeral: true,
                // });
                break;
            }
            default: { break; }
        }
    });

    selectCollector.on("end", async (collected, reason) => {
        client.cooldowns.delete(interaction.user.id);
        if (collected.size > 0 && reason == 'time') {
            clearTimeout(timeout);
            await collected.first().editReply({
                embeds: [embed],
                components: [],
            });
            setTimeout(async () => {
                await collected.first().followUp({
                    content: 'Твоите менюта изчезнаха, поради дълго време на неактивност.',
                    ephemeral: true,
                });
            }, 2000);
        } else if (collected.size == 0) {
            const user = interaction.member.user;
            await interaction.editReply({
                content: `${user}, твоето време за избор на урок или аудиоклип изтече! Моля, опитай отново.`,
                components: [],
            });
        }
    });
}

module.exports = { textPagination, imgPagination, videoPagination, audioPagination };