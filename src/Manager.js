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
    /**
     * @type {import("./types/index.js").GiveawayOptions[]}
     */
    this.giveaways = [];
    this.giveaway = null;
    this.pingEveryone = options.pingEveryone;
    this.emoji = options.emoji || "🎁";

    this.client.on("ready", async () => {
      try {
        await this.getGiveaways();
        await this.handleGiveaway();
        this.emit("GiveawayReady", "Real Giveaways");
      } catch (error) {
        console.error("Error in handling giveaways on ready:", error);
      }
    });

    this.client.on("interactionCreate", async (interaction) => {
      try {
        if (interaction.isButton()) {
          await interaction.deferUpdate().catch(() => {});

          const { member } = interaction;
          const messageId = interaction.message.id;

          const data = this.giveaways.find((g) => g.messageId === messageId);

          if (!data) {
            return console.error(`Invalid giveaway data`);
          }

          if (Number(data?.endTime) < Date.now()) {
            this.emit("InvalidGiveaway", member, createGiveaway(data));
          } else {
            const userEntry = data.entry?.find(
              (entry) => entry.userID === member.id
            );

            if (userEntry) {
              // User is already entered, remove entry
              data.entry = data.entry.filter(
                (entry) => entry.userID !== member.id
              );
              data.entered -= 1;

              await this.editGiveaway(messageId, createGiveaway(data));
              await this.getGiveaways();
              this.emit("UserLeftGiveaway", member, createGiveaway(data));
            } else {
              // User is not entered, add entry
              data.entry.push({
                userID: member.id,
                guildID: interaction.guild.id,
                messageID: messageId,
              });
              data.entered += 1;

              await this.editGiveaway(messageId, createGiveaway(data));
              await this.getGiveaways();
              this.emit("UserJoinGiveaway", member, createGiveaway(data));
            }
          }
        }
      } catch (error) {
        console.error("Error in handling interaction:", error);
      }
    });
  }

  connect(mongouri) {
    if (mongoose.connection.readyState === 1) return;
    mongoose.connect(mongouri);
    return mongoose.connection.readyState === 1 ? true : false;
  }

  async handleGiveaway() {
    // code
    setInterval(async () => {
      try {
        for (const guild of this.client.guilds.cache.values()) {
          const dbPromises = this.giveaways
            .filter((g) => g.guildId === guild.id)
            .map((data) =>
              fetchGCM(this.client, this.giveaways, data.messageId)
            );

          const dbResults = await Promise.all(dbPromises);

          for (const data of dbResults) {
            if (!data) continue;

            const { message } = data;
            if (!message) continue;

            this.giveaway = new Giveaway(this, { ...data, message });
            if (!data.ended) {
              await this.checkWinner(message);
            }
          }
        }
      } catch (error) {
        console.error("Error in handling giveaways:", error);
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
      // Mark the giveaway as ended before selecting a winner
      data.ended = true;
      await this.editGiveaway(data.messageId, data);

      // Check if any user has entered the giveaway
      if (data.entered > 0) {
        await this.getWinner(data.messageId);
      } else {
        // No user entered, emit the NoWinner event
        const { message } = await fetchGCM(
          this.client,
          this.giveaways,
          data.messageId
        );
        this.emit("NoWinner", message, createGiveaway(data));

        // Update the message and embed for the case of no winner
        const gData = createGiveaway(data);
        const embed = this.GiveawayEndNoWinnerEmbed(gData);
        await editEmbed(message, data, embed);
      }

      // await this.deleteGiveaway(data.messageId);
    }
  }

  /**
   * @param {String} messageID
   */
  async getWinner(messageID) {
    const data = this.giveaways.find((g) => g.messageId === messageID);
    if (!data) return [];

    const { message } = await fetchGCM(this.client, this.giveaways, messageID);
    const winArr = [];
    const winCt = data.winCount;
    const entries = [...data.entry]; // Create a copy to avoid modifying the original array

    for (let i = 0; i < winCt && entries.length > 0; i++) {
      const winno = Math.floor(Math.random() * entries.length);
      const winner = entries[winno];

      winArr.push(winner);
      entries.splice(winno, 1); // Remove the winner from the array
    }

    data.winners = winArr;

    await this.editGiveaway(messageID, { winners: winArr, ended: true });

    await this.getGiveaways();

    const gData = createGiveaway(data);
    const embed =
      winArr.length > 0
        ? this.GiveawayEndWinnerEmbed(gData)
        : this.GiveawayEndNoWinnerEmbed(gData);

    if (winArr.length > 0) {
      this.emit("GiveawayWinner", message, gData);
    } else {
      this.emit("NoWinner", message, gData);
      // Update the message and embed for the case of no winner
      await editEmbed(message, data, embed);
    }

    return Promise.resolve(winArr);
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
    const data = { ...giveawaydata };
    this.giveaway = new Giveaway(this, { ...data, message: message });
    const gData = createGiveaway(data);

    this.emit("GiveawayStarted", message, gData);

    await this.getGiveaways();
    // await this.checkWinner(message);
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
        text: `${giveaway.entered || 0} Users Joined`,
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

    await this.editGiveaway(messageId, giveaway);

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

    await this.editGiveaway(messageId, giveaway);

    return giveaway;
  }

  /**
   *
   * @param {import("./types/index.js").GiveawayOptions} giveaway
   */
  async updateGiveaway(giveaway) {
    const { message } = await fetchGCM(
      this.client,
      this.giveaways,
      giveaway.messageId
    );

    // Update message content
    const newContent = `${this.pingEveryone ? "@everyone" : ""}`;
    if (message.content !== newContent) {
      await message.edit({ content: newContent });
    }

    // Update message embed
    const existingEmbed = message.embeds[0];
    const newEmbed = this.GiveawayStartEmbed({
      prize: giveaway.prize,
      endTime: giveaway.endTime,
      hostedBy: giveaway.hostedBy,
      winCount: giveaway.winCount,
      started: giveaway.started,
      entered: giveaway.entered,
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
  }

  // database
  async saveGiveaway(giveawaydata) {
    // code
    const DbModel = new GModel(giveawaydata);
    await DbModel.save();
    return createGiveaway(DbModel);
  }

  /**
   *
   * @param {String} messageId
   * @param {import("./types/index.js").GiveawayOptions} giveawaydata
   * @returns
   */
  async editGiveaway(messageId, giveawaydata) {
    const data = await GModel.findOneAndUpdate(
      { messageId: messageId, ended: false },
      giveawaydata,
      { new: true }
    )
      .lean()
      .exec();

    if (!data) return false;

    this.updateGiveaway(data);

    return data;
  }

  async getGiveaways() {
    const giveawayDocs = await GModel.find().lean();
    this.giveaways = giveawayDocs.map((doc) => createGiveaway(doc));

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

  /**
   * return deleted number count like 1 , 19 , 23
   * @param {String} guildId
   * @returns
   */
  async deleteall(guildId) {
    let data = await GModel.deleteMany({ guildId: guildId });

    await this.getGiveaways();

    return data.deletedCount > 0;
  }
}

module.exports = Manager;
