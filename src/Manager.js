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
const {
  fetchGCM,
  editEmbed,
  createGiveaway,
  deepEqual,
} = require("./utils/functions");
const mongoose = require("mongoose");
const { Giveaway } = require("./Giveaway");

mongoose.set("strictQuery", false);

class Manager extends EventEmitter {
  /**
   *
   * @param {Client} client
   * @param {import("./types/index.js").ManagerOptions} options
   */
  constructor(client, options) {
    super();
    this.client = client;
    this.embedColor = options.embedColor;
    this.giveaways = [];
    this.giveaway = null;
    this.pingEveryone = options.pingEveryone;
    this.emoji = options.emoji || "🎁";
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
    if (mongoose.connection.readyState === 1) return;
    mongoose.connect(mongouri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    return mongoose.connection.readyState === 1 ? true : false;
  }

  async handleGiveaway() {
    // code
    process.setMaxListeners(0);
    await this.client.guilds.fetch();

    setInterval(async () => {
      for (const guild of this.client.guilds.cache.values()) {
        const dbPromises = this.giveaways
          .filter((g) => g.guildId === guild.id)
          .map((data) => fetchGCM(this.client, this.giveaways, data.messageId));
        const dbResults = await Promise.all(dbPromises);

        for (const data of dbResults) {
          if (!data) continue;
          const { message } = data;
          if (!message) continue;
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
        }
      }
    }, 5000);
  }

  async checkWinner(message) {
    if (!message) return;
    const index = this.giveaways.findIndex(
      (g) => g.messageId === message.id && g.ended === false
    );
    if (index === -1) return;
    const data = this.giveaways[index];
    const now = Date.now();
    if (data.endTime && Number(data.endTime) < now) {
      // code that uses `now` here
      let winnerPromise = this.getWinner(data.messageId);
      return winnerPromise;
    }
  }
  /**
   *
   * @param {String} messageID
   */
  async getWinner(messageID) {
    const data = await GModel.aggregate([
      { $match: { messageId: messageID } },
      { $sample: { size: 1 } },
    ]);
    if (!data || !data[0]) return;
    const { message } = await fetchGCM(this.client, this.giveaways, messageID);
    const winArr = [];
    const winCt = data[0].winCount;
    const entries = data[0].entry;

    await Promise.all(
      Array.from({ length: winCt }).map(async () => {
        while (true) {
          const winno = Math.floor(Math.random() * data[0].entered);
          if (!winArr.includes(entries[winno])) {
            winArr.push(entries[winno]);
            break;
          }
        }
      })
    );

    data[0].winners = winArr;
    data[0].ended = true;

    await GModel.updateOne(
      { messageId: messageID },
      { $set: { winners: winArr, ended: true } }
    );

    await this.getGiveaways();

    const gData = createGiveaway(data[0]);
    const embed =
      winArr.length > 0
        ? this.GiveawayEndWinnerEmbed(gData)
        : this.GiveawayEndNoWinnerEmbed(gData);

    if (winArr.length > 0) {
      this.emit("GiveawayWinner", message, gData);
    } else {
      this.emit("NoWinner", message, gData);
    }

    await editEmbed(message, data[0], embed);

    return Promise.resolve(gData);
  }

  /**
   *
   * @param {import("discord.js").Interaction} interaction
   */
  async handleInteraction(interaction) {
    if (interaction.isButton()) {
      const { member } = interaction;
      if (member.user.bot) return;
      if (!interaction.deferred || !interaction.replied) {
        await interaction?.deferUpdate().catch(() => {});
      }
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
          await data.save();
          await updateentry(data.entered);
          await this.getGiveaways();
          let gData = createGiveaway(data);
          this.emit("UserLeftGiveaway", member, gData);
        } else {
          data.entry.push({
            userID: interaction.member.id,
            guildID: interaction.guild.id,
            messageID: interaction.message.id,
          });
          data.entered = data.entered + 1;
          await data.save();
          await updateentry(data.entered);
          await this.getGiveaways();
          let gData = createGiveaway(data);
          this.emit("UserJoinGiveaway", member, gData);
        }
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
    const { channel, duration, prize, winnerCount } = options;
    const timeStart = Date.now();
    const endTime = Date.now() + ms(duration);

    const joinBtn = new ButtonBuilder()
      .setCustomId("join_btn")
      .setStyle(ButtonStyle.Success)
      .setEmoji(this.emoji)
      .setLabel("Join");

    const btnRow = new ActionRowBuilder().addComponents([joinBtn]);

    const GiveawayEmbed = this.GiveawayStartEmbed({
      prize: prize,
      endTime: endTime,
      hostedBy: interaction.member.id,
      winCount: winnerCount,
      started: timeStart,
      entered: 0,
    });

    const sendOptions = {
      content: `${this.pingEveryone ? "@everyone" : " "} `,
      embeds: [GiveawayEmbed],
      components: [btnRow],
    };

    // Cache frequently used data
    const guild = await GModel.findOne({ guildId: interaction.guild.id });

    const message = await channel.send(sendOptions);

    const [giveawaydata] = await Promise.all([
      this.saveGiveaway({
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
      }),
    ]);

    // Reuse the cached guild object instead of querying it again
    const data = { ...giveawaydata, guild };
    console.log(data);
    this.giveaway = new Giveaway(this, { ...data, message: message });
    const gData = createGiveaway(data);

    this.emit("GiveawayStarted", message, gData);

    // Only call getGiveaways() once if needed
    if (message) {
      await this.getGiveaways();
    }

    await this.checkWinner(message);
  }

  GiveawayStartEmbed(giveaway) {
    const endTimestamp = (giveaway.endTime / 1000) | 0;
    const description = `Click on Join Button To Enter in Giveaway`;
    const prize = `> \`${giveaway.prize}\``;
    const endsIn = `> <t:${endTimestamp}:R>`;
    const winners = `> \`${giveaway.winCount}\``;
    const hostedBy = `> <@${giveaway.hostedBy}>`;

    const GiveawayEmbed = new EmbedBuilder()
      .setColor(this.embedColor)
      .setTitle(`Real Giveaways`)
      .setTimestamp(Date.now())
      .setDescription(description)
      .setFooter({
        text: `0 Users Joined`,
      })
      .addFields([
        { name: `Prize`, value: prize, inline: true },
        { name: `Ends In`, value: endsIn, inline: true },
        { name: `Winners`, value: winners, inline: true },
        { name: `Hosted By`, value: hostedBy },
      ]);

    return GiveawayEmbed;
  }

  /**
   *
   * @param {import("./types").GiveawayOptions} giveaway
   * @returns
   */
  GiveawayEndNoWinnerEmbed(giveaway) {
    const currentTime = Math.floor(Date.now() / 1000);

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
          value: `> <t:${currentTime}:R>`,
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
    const winners = [];
    for (let i = 0; i < giveaway.winners.length; i++) {
      winners.push(`<@${giveaway.winners[i].userID}>`);
    }

    const currentTime = Date.now();

    const GiveawayEmbed = new EmbedBuilder()
      .setColor(this.embedColor)
      .setTitle(`Real Giveaways`)
      .setTimestamp(currentTime)
      .setDescription(`Giveaway Ended , ${winners.join(", ")} are Winners`)
      .setFooter({
        text: `Total entries: ${giveaway.entered}`,
      })
      .addFields([
        {
          name: `Ended At`,
          value: `> <t:${Math.floor(currentTime / 1000)}:R>`,
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
   * return deleted number count like 1 , 19 , 23
   * @param {String} guildId
   * @returns
   */
  async deleteall(guildId) {
    const giveawaydata = await GModel.find({ guildId });
    const deletePromises = [];

    for (const data of giveawaydata) {
      const { message } = await fetchGCM(
        this.client,
        this.giveaways,
        data.messageId
      );
      if (message?.id) {
        deletePromises.push(message.delete().catch(() => {}));
      }
      deletePromises.push(data.delete());
    }

    await Promise.all(deletePromises);
    await this.getGiveaways();

    return { deleted: giveawaydata.length };
  }

  async getGiveaways() {
    const cursor = GModel.find().cursor();
    const giveaways = [];
    for (
      let doc = await cursor.next();
      doc != null;
      doc = await cursor.next()
    ) {
      giveaways.push(createGiveaway(doc.toObject()));
    }
    this.giveaways = giveaways;
    return this.giveaways;
  }

  async deleteGiveaway(messageId) {
    const { message, guild } = await fetchGCM(
      this.client,
      this.giveaways,
      messageId
    );
    await message?.delete().catch((e) => {});
    if (!guild) return false;
    const result = await GModel.deleteOne({ messageId });
    await this.getGiveaways();
    return result.deletedCount > 0;
  }

  async endGiveaway(messageId) {
    // code
    const gdata = this.giveaways.find((g) => g.messageId == messageId);
    if (gdata?.ended) return false;
    const giveaway = await this.getWinner(messageId);
    return giveaway;
  }

  async rerollGiveaway(messageId) {
    // code
    const giveaway = await this.getWinner(messageId);
    const { message } = await fetchGCM(this.client, this.giveaways, messageId);
    this.emit("GiveawayRerolled", message, giveaway);
    if (giveaway) {
      return giveaway;
    } else {
      return false;
    }
  }

  /**
   *
   * @param {String} messageId
   * @param {import("./types/index.js").GiveawayOptions} giveawaydata
   * @returns
   */
  async editGiveaway(messageId, giveawaydata) {
    const updated = await GModel.findOneAndUpdate(
      { messageId: messageId, ended: false },
      giveawaydata,
      { new: true }
    )
      .lean()
      .exec();

    if (!updated) {
      return false;
    }

    const { message } = await fetchGCM(this.client, this.giveaways, messageId);

    // Update message content
    const newContent = `${this.pingEveryone ? "@everyone" : ""}`;
    if (message.content !== newContent) {
      await message.edit({ content: newContent });
    }

    // Update message embed
    const existingEmbed = message.embeds[0];
    const newEmbed = this.GiveawayStartEmbed({
      prize: updated.prize,
      endTime: updated.endTime,
      hostedBy: updated.hostedBy,
      winCount: updated.winCount,
      started: updated.started,
      entered: updated.entered,
    });

    if (!deepEqual(existingEmbed.fields, newEmbed.fields)) {
      await message.edit({ embeds: [newEmbed] });
    }

    // Update message button components
    const existingComponents = message.components[0]?.components;
    const newComponents = [
      new ButtonBuilder()
        .setCustomId("join_btn")
        .setStyle(ButtonStyle.Success)
        .setEmoji(this.emoji)
        .setLabel("Join"),
    ];

    if (!deepEqual(existingComponents, newComponents)) {
      const btnRow = new ActionRowBuilder().addComponents(newComponents);
      await message.edit({ components: [btnRow] });
    }

    return updated;
  }

  async saveGiveaway(giveawaydata) {
    // code
    const DbModel = new GModel(giveawaydata);
    await DbModel.save();
    return createGiveaway(DbModel);
  }

  async pauseGiveaway(messageId) {
    const giveaway = this.giveaways.find((g) => g.messageId === messageId);
    if (!giveaway) {
      throw new Error(`Giveaway with message ID ${messageId} not found.`);
    }

    if (giveaway.paused) {
      throw new Error(
        `Giveaway with message ID ${messageId} is already paused.`
      );
    }

    giveaway.paused = true;
    giveaway.remainingTime = giveaway.endTime - Date.now();

    const data = await GModel.findOneAndUpdate(
      { messageId },
      { paused: true, remainingTime: giveaway.remainingTime },
      { new: true }
    );

    if (!data) {
      throw new Error(
        `Failed to update the paused status for giveaway with message ID ${messageId}.`
      );
    }

    return giveaway;
  }

  async resumeGiveaway(messageId) {
    const giveaway = this.giveaways.find((g) => g.messageId === messageId);
    if (!giveaway) {
      throw new Error(`Giveaway with message ID ${messageId} not found.`);
    }

    if (!giveaway.paused) {
      throw new Error(`Giveaway with message ID ${messageId} is not paused.`);
    }

    giveaway.paused = false;
    giveaway.endTime = Date.now() + giveaway.remainingTime;

    const data = await GModel.findOneAndUpdate(
      { messageId },
      { paused: false, endTime: giveaway.endTime },
      { new: true }
    );

    if (!data) {
      throw new Error(
        `Failed to update the paused status for giveaway with message ID ${messageId}.`
      );
    }

    return giveaway;
  }
}

module.exports = Manager;
