const { EventEmitter } = require("node:events");
const GiveawaySystem = require("./GiveawaySystem");
const GModel = require("./utils/GModel");

class Giveaway extends EventEmitter {
  /**
   *
   * @param {GiveawaySystem} manager
   * @param {import("./types").GiveawayOptions} options
   */
  constructor(manager, options) {
    super();
    this.manager = manager;
    this.messageId = options.messageId;
    this.endTime = options.endTime;
    this.ended = options.ended;
    this.entered = options.entered;
    this.entry = options.entry;
    this.guildId = options.guildId;
    this.host = options.host;
    this.prize = options.prize;
    this.started = options.started;
    this.winCount = options.winCount;
    this.message = options.message;
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

  async end() {
    // code
    if (this.ended) return false;
    const giveaway = await this.manager.getWinner(this.message, this.messageId);
    return giveaway;
  }

  async reroll() {
    setTimeout(async () => {
      const giveaway = await this.manager.getWinner(
        this.message,
        this.messageId
      );
      this.manager.emit("GiveawayRerolled", this.message, this);
      return giveaway;
    }, 1000 * 15);
  }

  async edit(prize, winCount) {
    // code
    const data = await GModel.findOne({
      messageId: this.messageId,
      ended: false,
    });
    if (!data) return false;
    data.prize = prize;
    data.winCount = winCount;
    data.save().then(() => this.manager.getGiveaways());
    return data;
  }

  async delete() {
    // code
    const data = await GModel.deleteOne({ messageId: this.messageId });
    if (data) {
      return true;
    } else {
      return false;
    }
  }
}

module.exports = Giveaway;
