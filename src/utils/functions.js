const { Client } = require("discord.js");

/**
 *
 * @param {Client} client
 * @param {import("../types").GiveawayOptions[]} giveaways
 * @param {String} messageId
 * @returns
 */
async function fetchGCM(client, giveaways, messageId) {
  let giveaway = giveaways.find((g) => g.messageId === messageId);
  if (!giveaway) return;
  let guild = client.guilds.cache.get(giveaway.guildId);
  if (!guild) {
    await client.guilds.fetch(giveaway.guildId).catch((e) => {});
  }
  let channel = guild?.channels.cache.get(giveaway.channelId);
  if (!channel) {
    await guild.channels.fetch(giveaway.channelId).catch((e) => {});
  }
  let message = channel?.messages.cache.get(giveaway?.messageId);
  if (!message) {
    await channel?.messages.fetch(giveaway?.messageId).catch((e) => {});
  }
  let obj = {};
  if (message && channel && guild) {
    obj["message"] = message;
    obj["channel"] = channel;
    obj["guild"] = guild;
  } else {
    obj["message"] = {};
    obj["channel"] = {};
    obj["guild"] = {};
  }
  return obj;
}

async function editEmbed(message, giveawaydata, embed) {
  let channel = message.guild.channels.cache.get(giveawaydata.channelId);
  if (!channel) return;
  let msg = await channel.messages.fetch(giveawaydata.messageId);
  msg
    .edit({
      embeds: [embed],
      components: [],
    })
    .catch((e) => {});
}

function createGiveaway(data) {
  return {
    messageId: data.messageId,
    channelId: data.channelId,
    guildId: data.guildId,
    prize: data.prize,
    started: data.started,
    entry: data.entry,
    entered: data.entered,
    winCount: data.winCount,
    endTime: data.endTime,
    hostedBy: data.hostedBy,
    ended: data.ended,
    winners: data.winners,
  };
}

module.exports = { fetchGCM, editEmbed, createGiveaway };
