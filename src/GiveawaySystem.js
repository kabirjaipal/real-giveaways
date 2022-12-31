const {
  Client,
  ActionRowBuilder,
  EmbedBuilder,
  CommandInteraction,
} = require("discord.js");
const { EventEmitter } = require("node:events");
const { joinBtn, EndBtn, RerollBtn } = require("./utils/buttons");
const ms = require("ms");
const GModel = require("./utils/GModel");
const { send, fetchGCM } = require("./utils/functions");
const Giveaway = require("./Giveaway");
const mongoose = require("mongoose");

class GiveawaySystem extends EventEmitter {
  /**
   *
   * @param {Client} client
   * @param {import("./types").ManagerOptions} options
   */
  constructor(client, options) {
    super();
    this.client = client;
    this.embedColor = options.embedColor;
    this.giveaways = [];
    this.giveaway = null;
    this.client.on("ready", async () => {
      await this.getGiveaways().then(() => {
        this.handleGiveaway().then(() => {
          this.emit("GiveawayReady");
        });
      });
    });
    this.client.on("interactionCreate", async (interaction) => {
      await this.handleInteraction(interaction);
    });
  }

  connect(mongouri) {
    mongoose
      .connect(mongouri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      })
      .then(() => {
        console.log(`Mongodb connected`);
      });
  }

  async handleGiveaway() {
    // code
    process.setMaxListeners(0);
    await this.client.guilds.fetch();

    setInterval(() => {
      this.client.guilds.cache.forEach(async (guild) => {
        if (!guild) return;
        // const db = await GModel.find({ guildId: guild.id, ended: false });
        const db = this.giveaways.filter((g) => g.guildId === guild.id);
        if (!db) return;
        db.map(async (data) => {
          if (!data) return;
          const { message } = await fetchGCM(this, data.messageId);
          this.giveaway = new Giveaway(this, {
            messageId: data.messageId,
            channelId: data.channelId,
            guildId: data.guildId,
            prize: data.prize,
            started: data.started,
            entry: data.entry,
            entered: data.entered,
            winCount: data.winCount,
            endTime: data.endTime,
            host: data.host,
            ended: data.ended,
            message: message,
          });
          if (!data.ended) {
            await this.checkWinner(message);
          }
        });
      });
    }, 5000);
  }

  async checkWinner(msg) {
    if (!msg) return;
    const data = await GModel.findOne({ messageId: msg.id, ended: false });
    if (!data) return;
    if (data.endTime && Number(data.endTime) < Date.now()) {
      //  code
      let winner = await this.getWinner(msg, data.messageId);
      return winner;
    }
  }
  /**
   *
   * @param {import("discord.js").Interaction} interaction
   * @param {String} messageID
   */
  async getWinner(interaction, messageID) {
    let data = await GModel.findOne({ messageId: messageID });
    if (!data) return;
    let channel = interaction.guild.channels.cache.get(data.channelId);
    if (!channel) return;
    let msg = channel.messages.cache.get(data.messageId);
    if (!msg) return;
    const winArr = [];
    const winCt = data.winCount;
    const entries = data.entry;

    for (let i = 0; i < winCt; i++) {
      const winno = Math.floor(Math.random() * data.entered);
      winArr.push(entries[winno]);
    }

    let winners = winArr;
    let member = msg.member;

    setTimeout(async () => {
      if (!data) return await msg.delete();
      data.ended = true;
      await data.save().then(async () => {
        await this.getGiveaways();
      });
      if (data.entered <= 0 || !winArr[0]) {
        this.emit("NoWinner", data, msg);
        await this.editEmbed(msg, data, {
          description: `Giveaway Ended , No One Joined`,
          fields: [
            {
              name: `Ended At`,
              value: `> <t:${Math.floor(Date.now() / 1000)}:R>`,
              inline: true,
            },
            {
              name: `Hosted By`,
              value: `> <@${data.host}>`,
              inline: true,
            },
            {
              name: `Prize`,
              value: `> \`${data.prize}\``,
              inline: true,
            },
          ],
        });
      } else {
        this.emit("GiveawayWinner", data, winners, member, msg);
        await this.editEmbed(msg, data, {
          description: `Giveaway Ended , ${winners
            .map((u) => `<@${u.userID}>`)
            .join(", ")} are Winners`,
          fields: [
            {
              name: `Ended At`,
              value: `> <t:${Math.floor(Date.now() / 1000)}:R>`,
              inline: true,
            },
            {
              name: `Hosted By`,
              value: `> <@${data.host}>`,
              inline: true,
            },
            {
              name: `Prize`,
              value: `> \`${data.prize}\``,
              inline: true,
            },
          ],
        });
      }
    }, 3000);

    return data;
  }

  /**
   *
   * @param {import("discord.js").Interaction} interaction
   */
  async handleInteraction(interaction) {
    // code
    if (interaction.isButton()) {
      await interaction?.deferUpdate().catch((e) => {});
      await interaction?.deferReply().catch((e) => {});
      const { member } = interaction;
      switch (interaction.customId) {
        case "join_btn":
          {
            const data = await GModel.findOne({
              messageId: interaction.message.id,
            });
            if (!data) return;
            function updateentry(entry) {
              let embeds = interaction.message.embeds[0];
              embeds.fields.find(
                (f) => f.name === `Joined`
              ).value = `> ${entry}`;
              interaction.message.edit({
                embeds: [EmbedBuilder.from(embeds)],
              });
            }
            if (Number(data?.endTime) < Date.now()) {
              this.emit("InvalidGiveaway", member, data);
            } else {
              const entris = data.entry?.find(
                (id) => id.userID === interaction.member.id
              );

              if (entris) {
                await GModel.findOneAndUpdate(
                  {
                    messageId: interaction.message.id,
                  },
                  {
                    $pull: { entry: { userID: interaction.member.id } },
                  }
                );

                data.entered = data.entered - 1;

                await data.save().then(async (a) => {
                  await updateentry(data.entered);
                  await this.getGiveaways();
                  this.emit("UserLeftGiveaway", member, data);
                });
              } else if (!entris) {
                data.entry.push({
                  userID: interaction.member.id,
                  guildID: interaction.guild.id,
                  messageID: interaction.message.id,
                });

                data.entered = data.entered + 1;

                await data.save().then(async (a) => {
                  await updateentry(data.entered);
                  await this.getGiveaways();
                  this.emit("UserJoinGiveaway", member, data);
                });
              }
            }
          }
          break;
        case "end_btn":
          {
            // let giveaway = await this.end(interaction, interaction.message.id);
            let giveaway = await this.giveaway.end();
            if (!giveaway) {
              send(interaction, `Giveaway Already Ended Sorry...`, true);
            } else {
              await send(interaction, `${giveaway.prize} Giveaway Ended`, true);
            }
          }
          break;
        case "reroll_btn":
          {
            // let giveaway = await this.reroll(
            //   interaction,
            //   interaction.message.id
            // );
            let giveaway = await this.giveaway.reroll();
            await send(
              interaction,
              `${giveaway.prize} Giveaway Rerolled`,
              true
            );
          }
          break;

        default:
          break;
      }
    }
  }
  /**
   *
   * @param {CommandInteraction} interaction
   * @param {import("./types").GiveawayStartOptions} options
   * @returns
   */
  async start(interaction, options) {
    return new Promise(async (resolve, reject) => {
      // code
      const { channel, duration, prize, winnerCount } = options;
      const timeStart = Date.now();
      const btnRow = new ActionRowBuilder().addComponents([
        joinBtn,
        EndBtn,
        RerollBtn,
      ]);
      const time = ms(duration);
      const endtime = Number((Date.now() + time).toString().slice(0, -3));

      const GiveawayEmbed = new EmbedBuilder()
        .setColor(this.embedColor)
        .setTitle(`Real Giveaways`)
        .setTimestamp(Number(Date.now() + time))
        .setDescription(`Click on Join Button To Enter in Giveaway`)
        .setFooter({
          text: `Real Development`,
          iconURL: interaction.guild.iconURL(),
        })
        .addFields([
          {
            name: `Prize`,
            value: `> ${prize}`,
          },
          {
            name: `Hosted By`,
            value: `> ${interaction.member}`,
            inline: true,
          },
          {
            name: `Ends In`,
            // value: `> <t:${endtime}:f>`,
            value: `> <t:${Math.round(endtime)}:R>`,
            inline: true,
          },
          {
            name: `Winners`,
            value: `> ${winnerCount}`,
            inline: true,
          },
          {
            name: `Joined`,
            value: `> 0`,
            inline: true,
          },
        ]);

      await channel
        .send({
          // content: `@everyone`,
          embeds: [GiveawayEmbed],
          components: [btnRow],
        })
        .then(async (msg) => {
          resolve({
            message: msg.id,
            winners: winnerCount,
            prize: prize,
            endsAt: endtime,
          });

          send(interaction, `Giveaway Started in ${channel}`, true);
          const tim = Number(Date.now() + time);
          let giveawaydata = {
            messageId: msg.id,
            channelId: channel.id,
            guildId: interaction.guild.id,
            prize: prize,
            started: timeStart,
            entry: [],
            entered: 0,
            winCount: winnerCount,
            endTime: tim,
            host: interaction.member.id,
            ended: false,
          };
          let data = await this.saveGiveaway(msg.id, giveawaydata);
          this.giveaway = new Giveaway(this, data);

          this.emit("GiveawayStarted", msg, this.giveaway);
          await this.getGiveaways();
          await this.checkWinner(msg);
        })
        .catch((e) => reject(e));
    });
  }

  async end(interaction, messageID) {
    // code
    const db = this.giveaways.find((g) => g.messageID === messageID);
    if (!db) return false;
    if (db.ended) {
      return false;
    } else {
      const giveaway = await this.getWinner(interaction, messageID);
      return giveaway;
    }
  }

  async reroll(interaction, messageID) {
    setTimeout(async () => {
      const giveaway = await this.getWinner(interaction, messageID);
      return giveaway;
    }, 1000 * 15);
  }

  async edit(messageID, prize, winCount) {
    // code
    let giveawaydata = this.giveaways.find((g) => g.messageId === messageID);
    giveawaydata.prize = prize;
    giveawaydata.winCount = winCount;
    let data = await this.editGiveaway(messageID, giveawaydata);
    return data;
  }

  async delete(messageID) {
    // code
    const data = await this.deleteGiveaway(messageID);
    return data;
  }

  async deleteall(guildID) {
    // let data = await GModel.deleteMany({ guildId: guildID });
    let giveawaydata = await GModel.find({ guildId: guildID });
    let deleted = 0;
    await giveawaydata.forEach(async (data) => {
      const { message } = await fetchGCM(this, data.messageId);
      await message
        .delete()
        .then(async () => {
          deleted++;
          await data.delete();
        })
        .catch((e) => {});
    });
    await this.getGiveaways();
    return deleted;
  }

  async getGiveaways() {
    const data = await GModel.find();
    this.giveaways = data;
    return data;
  }

  async editEmbed(message, giveawaydata, embeddata) {
    // code
    let channel = message.guild.channels.cache.get(giveawaydata.channelId);
    if (!channel) return;
    let msg = await channel.messages.fetch(giveawaydata.messageId);
    let embed = EmbedBuilder.from(msg.embeds[0])
      .setDescription(embeddata.description || null)
      .setTimestamp()
      .setFields(embeddata.fields || []);
    msg.edit({
      embeds: [embed],
      components: [],
    });
  }

  async deleteGiveaway(messageId) {
    // code
    const { channel, message, guild } = await fetchGCM(this, messageId);
    await message?.delete().catch((e) => {});
    if (!guild) return;
    let data = await GModel.deleteOne({ messageId: messageId });
    if (!data) return false;
    this.getGiveaways();
    return true;
  }

  async editGiveaway(messageId, giveawaydata) {
    // code
    let data = await GModel.updateOne(
      { messageId: messageId, ended: false },
      giveawaydata
    ).exec();
    if (!data) return false;
    return data;
  }

  async saveGiveaway(messageId, giveawaydata) {
    // code
    const DbModel = new GModel(giveawaydata);
    await DbModel.save();
    return DbModel;
  }
}

module.exports = GiveawaySystem;
