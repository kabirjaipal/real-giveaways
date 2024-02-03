const Manager = require("./Manager");

class Giveaway {
  /**
   *
   * @param {Manager} manager
   * @param {import("./types").GiveawayOptions} options
   */
  constructor(manager, options) {
    this.manager = manager;
    this.messageId = options.messageId;
    this.endTime = new Date(options.endTime);
    this.ended = options.ended;
    this.entered = options.entered;
    this.entry = options.entry;
    this.guildId = options.guildId;
    this.channelId = options.channelId;
    this.hostedBy = options.hostedBy;
    this.prize = options.prize;
    this.started = new Date(options.started);
    this.winCount = options.winCount;
    this.message = options.message;
    this.winners = options.winners;
    this.guild = manager.client.guilds.cache.get(options.guildId);
    this.channel = this.guild?.channels.cache.get(options.channelId);
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
