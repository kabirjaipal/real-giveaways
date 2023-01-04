const {
  Client,
  GatewayIntentBits,
  ApplicationCommandType,
  ApplicationCommandOptionType,
  Colors,
  EmbedBuilder,
} = require("discord.js");
const mongoose = require("mongoose");
const GiveawaySystem = require("./src/GiveawaySystem");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

const manager = new GiveawaySystem(client, {
  embedColor: Colors.Blurple,
  pingEveryone: true,
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
  ];
  client.application.commands.set(commands);

  mongoose
    .connect(process.env.mongo, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => {
      console.log(`Mongodb connected`);
    });

  mongoose.set("strictQuery", false);
});

client.on("interactionCreate", async (interaction) => {
  await interaction.deferReply().catch((e) => {});

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
          const deleteall = await manager.deleteall(interaction.guildId);
          interaction.followUp({
            content: `${deleteall} Giveaways Deleted`,
          });
        }
        break;
      case "delete":
        {
          let messageId = interaction.options.getString("messageid");
          await manager.delete(messageId);
          interaction.followUp({
            content: `Giveaways Deleted`,
          });
        }
        break;

      default:
        break;
    }
  }
});

manager.on("GiveawayReady", (name) => {
  console.log(`${name} is Ready`);
});
manager.on("GiveawayStarted", (message, giveaway) => {
  // console.log("GiveawayStarted");
  message.reply(`Giveaway Started`);
});
manager.on("GiveawayWinner", (message, giveaway) => {
  // console.log("GiveawayWinner");
  let Gwinners = giveaway.winners.map((winner) => `<@${winner.userID}>`);
  message.channel.send(
    `${Gwinners} Won The \`${giveaway.prize}\` Giveaway Prize. Hosted By <@${giveaway.hostedBy}>`
  );

  giveaway.winners.map(async (user) => {
    const u = await message.guild.members.fetch(user.userID);
    u.send(`You Won The Giveaway ${message.url}`);
  });
});
manager.on("GiveawayRerolled", (message, giveaway) => {
  // console.log("GiveawayRerolled");
  message.reply(`\`${giveaway.prize}\` Giveaway Rerolled`);
});
manager.on("NoWinner", (message, giveaway) => {
  message.reply(`No One Won ${giveaway.prize}`);
});
manager.on("InvalidGiveaway", (member, giveaway) => {
  member.send(`You are Joining in Ended Giveaway`);
});
manager.on("UserJoinGiveaway", (member, giveaway) => {
  member.send(`You Joined ${giveaway.prize} Giveaway`);
});
manager.on("UserLeftGiveaway", (member, giveaway) => {
  member.send(`You Left ${giveaway.prize} Giveaway`);
});

client.login(process.env.token);

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
