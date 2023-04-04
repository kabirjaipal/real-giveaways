const Manager = require("./Manager");

class Giveaway {
  /**
   *
   * @param {Manager} manager
   * @param {import("./types").GiveawayOptions} options
   */
  constructor(
    manager,
    {
      messageId,
      endTime,
      ended,
      entered,
      entry,
      guildId,
      channelId,
      hostedBy,
      prize,
      started,
      winCount,
      message,
      winners,
    }
  ) {
    this.manager = manager;
    this.messageId = messageId;
    this.endTime = new Date(endTime);
    this.ended = ended;
    this.entered = entered;
    this.entry = entry;
    this.guildId = guildId;
    this.channelId = channelId;
    this.hostedBy = hostedBy;
    this.prize = prize;
    this.started = new Date(started);
    this.winCount = winCount;
    this.message = message;
    this.winners = winners;
    this.guild = manager.client.guilds.cache.get(guildId);
    this.channel = this.guild?.channels.cache.get(channelId);
  }

  get getUrl() {
    return `https://discord.com/channels/${this.guildId}/${this.channelId}/${this.messageId}`;
  }

  get remainingTime() {
    return this.endTime.getTime() - Date.now();
  }

  get duration() {
    return this.endTime.getTime() - this.started.getTime();
  }

  get isEnded() {
    return this.ended;
  }

  get enteredCount() {
    return this.entered;
  }
}

module.exports = { Giveaway };
