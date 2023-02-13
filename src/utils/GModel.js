const { model, Schema } = require("mongoose");

module.exports = model(
  "giveaway-schema",
  new Schema({
    messageId: String,
    channelId: String,
    guildId: String,
    prize: String,
    started: String,
    entry: Array,
    entered: Number,
    winCount: Number,
    endTime: String,
    hostedBy: String,
    ended: Boolean,
    winners: Array,
  })
);
