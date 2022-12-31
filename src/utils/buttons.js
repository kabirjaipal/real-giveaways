const { ButtonBuilder, ButtonStyle } = require("discord.js");

const joinBtn = new ButtonBuilder()
  .setCustomId("join_btn")
  .setStyle(ButtonStyle.Success)
  .setLabel("Join");

const EndBtn = new ButtonBuilder()
  .setCustomId("end_btn")
  .setStyle(ButtonStyle.Danger)
  .setLabel("End");

const RerollBtn = new ButtonBuilder()
  .setCustomId("reroll_btn")
  .setStyle(ButtonStyle.Primary)
  .setLabel("Reroll");

module.exports = { joinBtn, EndBtn, RerollBtn };
