# Real-Giveaway

Advance discord giveaways system with Support Slash/Message support

# Download

```cli
npm i real-giveaways
------ or ---------------------
yarn add real-giveaways
```

# Example

**_<p style="text-align: center;">[![Example](https://cdn.discordapp.com/attachments/1047177505901133946/1062019460438949969/image.png)](https://discord.gg/PcUVWApWN3)</p>_**

# Setting up

### Client values

```js
const { Client, GatewayIntentBits, Colors } = require("discord.js");
const { Manager } = require("real-giveaways");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

const manager = new Manager(client, {
  embedColor: Colors.Blurple,
  pingEveryone: false,
  emoji: "🎁",
});

client.on("ready", () => {
  console.log(`Bot is Running`);
  manager.connect("Mongo_Uri");
});
```

### For custom embed

```js
// for custom embed
class CustomManager extends Manager {
  GiveawayStartEmbed(giveaway) {
    let embed = new EmbedBuilder().setTitle(`Giveway Started`);
    return embed;
  }
  GiveawayEndNoWinnerEmbed(giveaway) {
    let embed = new EmbedBuilder().setTitle(`Giveway Ended No Winner`);
    return embed;
  }
  GiveawayEndWinnerEmbed(giveaway) {
    let embed = new EmbedBuilder().setTitle(`Giveway Ended Winners`);
    return embed;
  }
}

const manager = new CustomManager(client, {
  embedColor: Colors.Blurple,
  pingEveryone: false,
  emoji: "🎁",
});
```

### Commands

```js
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
```

### Manager Events

```js
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
  if(giveaway.winners.length > 0) {
    Gwinners = giveaway.winners
    .map((winner) => `<@${winner.userID}>`)
    .join(", ");
  } else {
    Gwinners = giveaway.winners[0]
  }
  message.channel?.send({
    content: Gwinners,
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
```

### Bugs, glitches and issues

If you encounter any problems feel free to open an issue in our <a href="https://github.com/kabirsingh2004/discord-giveaways/issues">GitHub repository</a> or join the [Discord server](https://discord.gg/PcUVWApWN3).
