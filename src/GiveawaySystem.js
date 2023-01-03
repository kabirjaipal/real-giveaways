const {
  Client,
  ActionRowBuilder,
  EmbedBuilder,
  CommandInteraction,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { EventEmitter } = require("node:events");
const ms = require("ms");
const GModel = require("./utils/GModel");
const { fetchGCM, editEmbed, createGiveaway } = require("./utils/functions");
const Giveaway = require("./Giveaway");
const mongoose = require("mongoose");

const joinBtn = new ButtonBuilder()
  .setCustomId("join_btn")
  .setStyle(ButtonStyle.Success)
  .setLabel("Join");

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
          this.emit("GiveawayReady", `Real Giveaways`);
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
        const db = this.giveaways.filter((g) => g.guildId === guild.id);
        if (!db) return;
        db.map(async (data) => {
          if (!data) return;
          const { message } = await fetchGCM(
            this.client,
            this.giveaways,
            data.messageId
          );
          if (!message) return;
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

  async checkWinner(message) {
    if (!message) return;
    const data = this.giveaways.find(
      (g) => g.messageId === message.id && g.ended === false
    );
    if (!data) return;
    if (data.endTime && Number(data.endTime) < Date.now()) {
      //  code
      let winner = await this.getWinner(data.messageId);
      return winner;
    }
  }
  /**
   *
   * @param {String} messageID
   */
  async getWinner(messageID) {
    let data = await GModel.findOne({ messageId: messageID });
    if (!data) return;
    const { message } = await fetchGCM(this.client, this.giveaways, messageID);
    const winArr = [];
    const winCt = data.winCount;
    const entries = data.entry;

    for (let i = 0; i < winCt; i++) {
      const winno = Math.floor(Math.random() * data.entered);
      winArr.push(entries[winno]);
    }

    let winners = winArr;
    let gData = createGiveaway(data);

    setTimeout(async () => {
      if (!data) return await message.delete();
      data.ended = true;
      await data.save().then(async () => {
        await this.getGiveaways();
      });
      if (data.entered <= 0 || !winArr[0]) {
        this.emit("NoWinner", message, gData);
        await editEmbed(message, data, {
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
        this.emit("GiveawayWinner", message, winners, gData);
        await editEmbed(message, data, {
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

    return gData;
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
              interaction.message.edit({
                embeds: [
                  EmbedBuilder.from(embeds).setFooter({
                    text: `${entry} Users Joined`,
                    iconURL: interaction.guild.iconURL(),
                  }),
                ],
              });
            }
            let gData = createGiveaway(data);
            if (Number(data?.endTime) < Date.now()) {
              this.emit("InvalidGiveaway", member, gData);
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
                  let gData = createGiveaway(data);
                  this.emit("UserLeftGiveaway", member, gData);
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
                  let gData = createGiveaway(data);
                  this.emit("UserJoinGiveaway", member, gData);
                });
              }
            }
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
      const btnRow = new ActionRowBuilder().addComponents([joinBtn]);
      const time = ms(duration);
      const endtime = Number((Date.now() + time).toString().slice(0, -3));

      // code embed

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
          this.giveaway = new Giveaway(this, { ...data, message: msg });
          let gData = createGiveaway(data);
          this.emit("GiveawayStarted", msg, gData);
          await this.getGiveaways();
          await this.checkWinner(msg);
        })
        .catch((e) => reject(e));
    });
  }

  async getGiveawayEmbed() {
    // code
    const GiveawayEmbed = new EmbedBuilder()
      .setColor(this.embedColor)
      .setTitle(`Real Giveaways`)
      .setTimestamp(Date.now())
      .setDescription(`Click on Join Button To Enter in Giveaway`)
      .setFooter({
        text: `0 Users Joined`,
      })
      .addFields([
        {
          name: `Prize`,
          value: `> {prize}`,
          inline: true,
        },
        {
          name: `Ends In`,
          value: `> {endAt}`,
          // value: `> <t:${Math.round(endtime)}:R>`,
          inline: true,
        },
        {
          name: `Winners`,
          value: `> {winnerCount}`,
          inline: true,
        },
        {
          name: `Hosted By`,
          value: `> {hostedBy}`,
          // inline: true,
        },
      ]);
  }

  async deleteall(guildID) {
    // let data = await GModel.deleteMany({ guildId: guildID });
    let giveawaydata = await GModel.find({ guildId: guildID });
    let deleted = 0;
    await giveawaydata.forEach(async (data) => {
      const { message } = await fetchGCM(
        this.client,
        this.giveaways,
        data.messageId
      );
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

  async deleteGiveaway(messageId) {
    // code
    const { message, guild } = await fetchGCM(
      this.client,
      this.giveaways,
      messageId
    );
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
    return createGiveaway(DbModel);
  }
}

module.exports = GiveawaySystem;
