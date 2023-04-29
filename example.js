require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  ApplicationCommandType,
  ApplicationCommandOptionType,
  Colors,
  EmbedBuilder,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});
const { Manager } = require('./index');
const manager = new Manager(client, {
  embedColor: Colors.Blurple,
  pingEveryone: false,
  emoji: "🎁",
  databaseType: 'json', // 'mongo' & 'json'
  databasePath: './database/giveaways'
});

client.on("ready", () => {
  console.log("Online");
  const commands = [
    {
      name: "delete",
      description: `delete giveaway`,
      type: ApplicationCommandType.ChatInput,
      options: [
        {
          name: "messageid",
          description: `give message id of giveaway`,
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: "edit",
      description: `edit giveaway`,
      type: ApplicationCommandType.ChatInput,
      options: [
        {
          name: "messageid",
          description: `give message id of giveaway`,
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "prize",
          description: `give Prize of giveaway`,
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "wincount",
          description: `give Winner Count of giveaway`,
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: "end",
      description: `end giveaway`,
      type: ApplicationCommandType.ChatInput,
      options: [
        {
          name: "messageid",
          description: `give message id of giveaway`,
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: "reroll",
      description: `reroll giveaway`,
      type: ApplicationCommandType.ChatInput,
      options: [
        {
          name: "messageid",
          description: `give message id of giveaway`,
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: "start",
      description: `start giveaway`,
      type: ApplicationCommandType.ChatInput,
      options: [
        {
          name: "channel",
          description: `channel`,
          type: ApplicationCommandOptionType.Channel,
          required: true,
        },
        {
          name: "prize",
          description: `prize`,
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "winnercount",
          description: `winnerCount`,
          type: ApplicationCommandOptionType.Number,
          required: true,
        },
        {
          name: "duration",
          description: `duration`,
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: "ping",
      description: `check bot ping`,
      type: ApplicationCommandType.ChatInput,
    },
  ];
  client.application.commands.set([]);
  client.guilds.cache.get("1070015200662663259")?.commands.set(commands);
  // Only for mongo db usage
  // manager.connect(process.env.MONGO_URL);
});

client.on("interactionCreate", async (interaction) => {
  await interaction.deferReply({ ephemeral: true }).catch((e) => {});

  if (interaction.isChatInputCommand()) {
    // code
    const cmdName = interaction.commandName;
    switch (cmdName) {
      case "start":
        {
          const channel = interaction.options.getChannel("channel");
          const prize = interaction.options.getString("prize");
          const winnerCount = interaction.options.getNumber("winnercount");
          const duration = interaction.options.getString("duration");
          interaction.followUp({
            content: `Giveaway Started`,
            ephemeral: true,
          });
          manager
            .start(interaction, {
              channel: channel,
              duration: duration,
              prize: prize,
              winnerCount: winnerCount,
            })
            .catch((e) => {
              console.log(e);
            });
        }
        break;
      case "delete":
        {
          let messageId = interaction.options.getString("messageid", true);
          let deleted = await manager.deleteGiveaway(messageId);
          interaction.followUp({
            content: `Giveaway ${deleted ? "Deleted" : "Not Deleted"}`,
          });
        }
        break;
      case "edit":
        {
          let messageId = interaction.options.getString("messageid", true);
          let prize = interaction.options.getString("prize", true);
          let wincount = interaction.options.getString("wincount", true);
          let edited = await manager.editGiveaway(messageId, {
            prize: prize,
            winCount: wincount,
          });
          if (edited) {
            interaction.followUp({
              content: `Giveaway Edited`,
            });
          } else {
            interaction.followUp({
              content: `Invalid Giveaway`,
            });
          }
        }
        break;
      case "reroll":
        {
          let messageId = interaction.options.getString("messageid", true);
          let rerolled = await manager.rerollGiveaway(messageId);
          if (rerolled) {
            interaction.followUp({
              content: `Giveaway Rerolled`,
            });
          } else {
            interaction.followUp({
              content: `Invalid Giveaway`,
            });
          }
        }
        break;
      case "end":
        {
          let messageId = interaction.options.getString("messageid", true);
          let ended = await manager.endGiveaway(messageId);
          if (ended) {
            interaction.followUp({
              content: `Giveaway Ended`,
            });
          } else {
            interaction.followUp({
              content: `Invalid Giveaway`,
            });
          }
        }
        break;
      case "ping":
        {
          return interaction.followUp({
            content: `Pong :: \`${client.ws.ping}\``,
            ephemeral: true,
          });
        }
        break;

      default:
        break;
    }
  }
});

let embed = new EmbedBuilder().setColor("Blurple");

manager.on("GiveawayReady", (name) => {
  console.log(`${name} is Ready`);
});
manager.on("GiveawayStarted", (message, giveaway) => {
  // console.log("GiveawayStarted");
  message.reply({
    embeds: [embed.setDescription(`Giveaway Started`)],
  });
});
manager.on("GiveawayWinner", (message, giveaway) => {
  let Gwinners
  if(giveaway.winners.length > 1) {
    Gwinners = giveaway.winners
    .map((winner) => `<@${winner.userID}>`)
    .join(", ");
  } else {
    Gwinners = `<@${giveaway.winners[0].userID}>`
  }
  message.channel?.send({
    content: `${Gwinners}`,
    embeds: [
      embed.setDescription(
        `${Gwinners} Won The \`${giveaway.prize}\` Giveaway Prize. Hosted By <@${giveaway.hostedBy}>`
      ),
    ],
  });

  giveaway.winners.map(async (user) => {
    const u = await message.guild.members.fetch(user.userID);
    u.send({
      embeds: [
        embed.setDescription(
          `You Won The Giveaway [\`Giveaway Link\`](${message.url})`
        ),
      ],
    });
  });
});
manager.on("GiveawayRerolled", (message, giveaway) => {
  // console.log("GiveawayRerolled");
  message.reply({
    embeds: [embed.setDescription(`\`${giveaway.prize}\` Giveaway Rerolled`)],
  });
});
manager.on("NoWinner", (message, giveaway) => {
  message.reply({
    embeds: [embed.setDescription(`No One Won ${giveaway.prize}`)],
  });
});
manager.on("InvalidGiveaway", (member, giveaway) => {
  member.send({
    embeds: [embed.setDescription(`You are Joining in Ended Giveaway`)],
  });
});
manager.on("UserJoinGiveaway", (member, giveaway) => {
  member.send({
    embeds: [embed.setDescription(`You Joined ${giveaway.prize} Giveaway`)],
  });
});
manager.on("UserLeftGiveaway", (member, giveaway) => {
  member.send({
    embeds: [embed.setDescription(`You Left ${giveaway.prize} Giveaway`)],
  });
});

client.login(process.env.TOKEN);

process.on("unhandledRejection", (reason, p) => {
  console.log(" [Error_Handling] :: Unhandled Rejection/Catch");
  console.log(reason, p);
});

process.on("uncaughtException", (err, origin) => {
  console.log(" [Error_Handling] :: Uncaught Exception/Catch");
  console.log(err, origin);
});

process.on("uncaughtExceptionMonitor", (err, origin) => {
  console.log(" [Error_Handling] :: Uncaught Exception/Catch (MONITOR)");
  console.log(err, origin);
});
