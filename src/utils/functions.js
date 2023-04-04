const { Client } = require("discord.js");

/**
 *
 * @param {Client} client
 * @param {import("../types").GiveawayOptions[]} giveaways
 * @param {String} messageId
 * @returns
 */
async function fetchGCM(client, giveaways, messageId) {
  const giveaway = giveaways.find((g) => g.messageId === messageId);
  if (!giveaway) return;

  const guildPromise = client.guilds.fetch(giveaway.guildId).catch(() => null);
  const channelPromise = guildPromise.then((guild) =>
    guild?.channels.fetch(giveaway.channelId).catch(() => null)
  );
  const messagePromise = channelPromise.then((channel) =>
    channel?.messages.fetch(giveaway.messageId).catch(() => null)
  );

  const [guild, channel, message] = await Promise.all([
    guildPromise,
    channelPromise,
    messagePromise,
  ]);

  return { guild, channel, message };
}

async function editEmbed(message, giveawaydata, embed) {
  try {
    let channel = message.guild.channels.cache.get(giveawaydata.channelId);
    if (!channel) return;
    let msg = await channel.messages.fetch(giveawaydata.messageId);
    if (!msg) return;
    await msg.edit({
      embeds: [embed],
      components: [],
    });
  } catch (error) {
    console.error(error);
  }
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

function deepEqual(a, b) {
  // If a and b are identical, return true
  if (a === b) return true;

  // If a and b are different types, return false
  if (typeof a !== typeof b) return false;

  // If a or b is null, return false
  if (a === null || b === null) return false;

  // If a and b are objects or arrays, recursively compare each property
  if (typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);

    // If a and b have different number of properties, return false
    if (aKeys.length !== bKeys.length) return false;

    // Recursively compare each property
    for (const key of aKeys) {
      if (!deepEqual(a[key], b[key])) return false;
    }

    return true;
  }

  // If a and b are of the same type and not objects or arrays, compare them directly
  return a === b;
}

module.exports = { fetchGCM, editEmbed, createGiveaway, deepEqual };
