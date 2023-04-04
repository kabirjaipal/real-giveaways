const { model, Schema } = require("mongoose");

const giveawaySchema = new Schema(
  {
    messageId: String,
    channelId: String,
    guildId: { type: String, index: true },
    prize: String,
    started: String,
    entry: Array,
    entered: Number,
    winCount: Number,
    endTime: { type: Date, index: true },
    hostedBy: String,
    ended: { type: Boolean, index: true },
    winners: Array,
    paused: Boolean,
  },
  { timestamps: true }
);

module.exports = model("giveaway", giveawaySchema);
