const {
  CommandInteraction,
  Message,
  ButtonBuilder,
  ActionRowBuilder,
  ComponentType,
} = require("discord.js");
const GiveawaySystem = require("../GiveawaySystem");

/**
 *
 * @param {CommandInteraction} interaction
 * @param {String} data
 * @param {Boolean} ephemeral
 */
async function send(interaction, data, ephemeral = false) {
  await interaction.deferReply().catch((e) => { });
  let reply = interaction.user
    ? interaction?.followUp?.bind(interaction)
    : interaction?.reply?.bind(interaction);

  reply({
    content: `${data}`,
    ephemeral: ephemeral,
  });
}

/**
 *
 * @param {GiveawaySystem} manager
 * @param {String} messageId
 * @returns
 */
async function fetchGCM(manager, messageId) {
  let giveaway = manager.giveaways.find((g) => g.messageId === messageId);
  if (!giveaway) return;
  let guild = manager.client.guilds.cache.get(giveaway.guildId) ||
    await manager.client.guilds.fetch(giveaway.guildId).catch(e => null)
  if (!guild) return;
  let channel = guild.channels.cache.get(giveaway.channelId) ||
    await guild.channels.fetch(giveaway.channelId).catch(e => null)
  if (!channel) return;
  let message = channel.messages.cache.get(giveaway.messageId) ||
    await channel?.messages.fetch(giveaway.messageId).catch(e => null)
  if (!message) return;
  if(channel && message && guild) {
    return guild, channel, message
  } else {
    return null
  }
}

module.exports = { send, fetchGCM };
