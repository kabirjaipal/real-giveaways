require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  ApplicationCommandType,
  ApplicationCommandOptionType,
  Colors,
  EmbedBuilder,
} = require("discord.js");
const { Manager } = require("./index");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

// // for custom embed
// class CustomManager extends Manager {
//   GiveawayStartEmbed(giveaway) {
//     let embed = new EmbedBuilder().setTitle(`Giveway Started`);
//     return embed;
//   }
//   GiveawayEndNoWinnerEmbed(giveaway) {
//     let embed = new EmbedBuilder().setTitle(`Giveway Ended No Winner`);
//     return embed;
//   }
//   GiveawayEndWinnerEmbed(giveaway) {
//     let embed = new EmbedBuilder().setTitle(`Giveway Ended Winners`);
//     return embed;
//   }
// }

// const manager = new CustomManager(client, {
//   embedColor: Colors.Blurple,
//   pingEveryone: true,
// });

const manager = new Manager(client, {
  embedColor: Colors.Blurple,
  pingEveryone: false,
  emoji: "🎁",
});

client.on("ready", () => {
  console.log("bot is ready !!");
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
      name: "deleteall",
      description: `delete all`,
      type: ApplicationCommandType.ChatInput,
    },
    {
      name: "ping",
      description: `check bot ping`,
      type: ApplicationCommandType.ChatInput,
    },
  ];
  client.guilds.cache.get("903532162236694539")?.commands.set(commands);

  manager.connect(
    "mongodb+srv://tofey16500:kabir315116@cluster0.l5qyqoq.mongodb.net/giveaways"
  );
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
      case "deleteall":
        {
          const data = await manager.deleteall(interaction.guildId);
          interaction.followUp({
            content: `${data?.deleted} Giveaways Deleted`,
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

// manager.on("GiveawayStarted", (message, giveaway) => {
//   // console.log("GiveawayStarted");
//   message
//     .reply({
//       embeds: [embed.setDescription(`Giveaway Started`)],
//     })
//     .then((msg) => {
//       setTimeout(() => {
//         msg.delete().catch((e) => {});
//       }, 3000);
//     });
// });

manager.on("GiveawayWinner", (message, giveaway) => {
  let Gwinners = giveaway.winners
    .map((winner) => `<@${winner.userID}>`)
    .join(", ");

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

client.login(
  "MTEzMjEyNDk4MjgwNjMzNTUxOA.Gb6Tha.Zh--HNmVZwDXo3bA3WYBBV7tyKEsRWs9LW9Ym8"
);

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
