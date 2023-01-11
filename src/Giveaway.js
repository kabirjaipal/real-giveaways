const GiveawaySystem = require("./GiveawaySystem");
const GModel = require("./utils/GModel");

class Giveaway {
  /**
   *
   * @param {GiveawaySystem} manager
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

  async end(messageId) {
    // code
    const gdata = this.manager.giveaways.find((g) => g.messageId == messageId);
    if (gdata?.ended) return false;
    const giveaway = await this.manager.getWinner(this.message, messageId);
    return giveaway;
  }

  async reroll(messageId) {
    setTimeout(async () => {
      const giveaway = await this.manager.getWinner(this.message, messageId);
      this.manager.emit("GiveawayRerolled", this.message, this);
      return giveaway;
    }, 1000 * 15);
  }

  async edit(messageId, prize, winCount) {
    // code
    const data = await GModel.findOne({
      messageId: messageId,
      ended: false,
    });
    if (!data) return false;
    data.prize = prize;
    data.winCount = winCount;
    data.save().then(() => this.manager.getGiveaways());
    return data;
  }

  async delete(messageId) {
    // code
    return await this.manager.deleteGiveaway(messageId);
  }
}

module.exports = Giveaway;
