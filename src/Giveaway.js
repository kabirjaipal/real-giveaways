const { Manager } = require("./Manager");

class Giveaway {
  /**
   *
   * @param {Manager} manager
   * @param {import("./types").GiveawayOptions} options
   */
  constructor(manager, options) {
    this.manager = manager;
    this.messageId = options.messageId;
    this.endTime = options.endTime;
    this.ended = options.ended;
    this.entered = options.entered;
    this.entry = options.entry;
    this.guildId = options.guildId;
    this.hostedBy = options.hostedBy;
    this.prize = options.prize;
    this.started = options.started;
    this.winCount = options.winCount;
    this.message = options.message;
    this.winners = options.winners;
  }

  get getUrl() {
    return `https://discord.com/channels/${this.guildId}/${this.channelId}/${this.messageId}`;
  }
  get remainingTime() {
    return this.endTime - Date.now();
  }
  get duration() {
    return this.endTime - this.started;
  }

  get isEnded() {
    return this.ended;
  }

  get enteredCount() {
    return this.entered;
  }
}

module.exports = { Giveaway };
