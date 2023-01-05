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
  .setEmoji("1059881434430578688")

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
    this.pingEveryone = options.pingEveryone;
    this.client.on("ready", async () => {
      await this.getGiveaways().then(() => {
        this.handleGiveaway().then(() => {
          this.emit("GiveawayReady", `Real Giveaways`);
        });
      });
    });
    this.client.on("interactionCreate", async (interaction) => {
      if (!interaction.inGuild()) return;
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
            data?.messageId
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
            hostedBy: data.hostedBy,
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

    // let winners = winArr;
    data.winners = winArr;
    let gData = createGiveaway(data);

    setTimeout(async () => {
      if (!data) return await message.delete();
      data.ended = true;
      await data.save().then(async () => {
        await this.getGiveaways();
      });
      if (data.entered <= 0 || !winArr[0]) {
        this.emit("NoWinner", message, gData);
        let embed = this.GiveawayEndNoWinnerEmbed(gData);
        await editEmbed(message, data, embed);
      } else {
        this.emit("GiveawayWinner", message, gData);
        let embed = this.GiveawayEndWinnerEmbed(gData);
        await editEmbed(message, data, embed);
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
      if (member.user.bot) {
        return interaction.followUp({
          content: `Bots are not allowed to join Giveaway`,
          ephemeral: true,
        });
      }
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
                    // iconURL: interaction.guild.iconURL(),
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
      const endTime = Number(Date.now() + time);
      const endsAt = Number((Date.now() + time).toString().slice(0, -3));

      // code embed
      let GiveawayEmbed = this.GiveawayStartEmbed({
        prize: prize,
        endTime: endsAt,
        hostedBy: interaction.member.id,
        winCount: winnerCount,
        started: timeStart,
      });
      let sendOptions = {
        content: `${this.pingEveryone ? "@everyone" : " "} `,
        embeds: [GiveawayEmbed],
        components: [btnRow],
      };
      let message = await channel.send(sendOptions).catch((e) => reject(e));
      let giveawaydata = {
        messageId: message.id,
        channelId: channel.id,
        guildId: interaction.guild.id,
        prize: prize,
        started: timeStart,
        entry: [],
        entered: 0,
        winCount: winnerCount,
        endTime: endTime,
        hostedBy: interaction.member.id,
        ended: false,
        winners: [],
      };
      let data = await this.saveGiveaway(message.id, giveawaydata);
      this.giveaway = new Giveaway(this, { ...data, message: message });
      let gData = createGiveaway(data);
      this.emit("GiveawayStarted", message, gData);
      await this.getGiveaways();
      await this.checkWinner(message);
    });
  }

  GiveawayStartEmbed(giveaway) {
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
          value: `> \`${giveaway.prize}\``,
          inline: true,
        },
        {
          name: `Ends In`,
          value: `> <t:${giveaway.endTime}:R>`,
          inline: true,
        },
        {
          name: `Winners`,
          value: `> \`${giveaway.winCount}\``,
          inline: true,
        },
        {
          name: `Hosted By`,
          value: `> <@${giveaway.hostedBy}>`,
          // inline: true,
        },
      ]);
    return GiveawayEmbed;
  }

  /**
   *
   * @param {import("./types").GiveawayOptions} giveaway
   * @returns
   */
  GiveawayEndNoWinnerEmbed(giveaway) {
    // code
    const GiveawayEmbed = new EmbedBuilder()
      .setColor(this.embedColor)
      .setTitle(`Real Giveaways`)
      .setTimestamp(Date.now())
      .setDescription(`Giveaway Ended , No One Joined`)
      .setFooter({
        text: `${giveaway.entered} Users Joined`,
      })
      .addFields([
        {
          name: `Ended At`,
          value: `> <t:${Math.floor(Date.now() / 1000)}:R>`,
          inline: true,
        },
        {
          name: `Hosted By`,
          value: `> <@${giveaway.hostedBy}>`,
          inline: true,
        },
        {
          name: `Prize`,
          value: `> \`${giveaway.prize}\``,
          inline: true,
        },
      ]);
    return GiveawayEmbed;
  }
  /**
   *
   * @param {import("./types").GiveawayOptions} giveaway
   * @returns
   */
  GiveawayEndWinnerEmbed(giveaway) {
    // code
    const GiveawayEmbed = new EmbedBuilder()
      .setColor(this.embedColor)
      .setTitle(`Real Giveaways`)
      .setTimestamp(Date.now())
      .setDescription(
        `Giveaway Ended , ${giveaway.winners
          .map((u) => `<@${u.userID}>`)
          .join(", ")} are Winners`
      )
      .setFooter({
        text: `${giveaway.entered} Users Joined`,
      })
      .addFields([
        {
          name: `Ended At`,
          value: `> <t:${Math.floor(Date.now() / 1000)}:R>`,
          inline: true,
        },
        {
          name: `Hosted By`,
          value: `> <@${giveaway.hostedBy}>`,
          inline: true,
        },
        {
          name: `Prize`,
          value: `> \`${giveaway.prize}\``,
          inline: true,
        },
      ]);
    return GiveawayEmbed;
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
      if (message?.id) await message.delete().catch((e) => {});
      deleted++;
      await data.delete();
    });
    await this.getGiveaways();
    return deleted;
  }

  async getGiveaways() {
    const data = await GModel.find();
    let giveaways = data.map((data) => createGiveaway(data));
    this.giveaways = giveaways;
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
