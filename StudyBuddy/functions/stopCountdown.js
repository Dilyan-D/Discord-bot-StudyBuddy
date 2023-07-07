async function stopCountdown(interval, message) {
    clearInterval(interval);
    return await message.delete();
}

module.exports = { stopCountdown };