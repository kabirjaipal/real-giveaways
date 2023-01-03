# Real-Giveaway

Advance discord giveaways system with Support Slash/Message support

# Download

```cli
npm i git+https://github.com/kabirsingh2004/discord-giveaways
------ or ---------------------
yarn add git+https://github.com/kabirsingh2004/discord-giveaways
```

# Setting up

## Client values

```js
const GiveawaySystem = require("@real/giveaways");
const { Client, Colors } = require("discord.js");

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
});
```

## Commands

```js
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
```

## Manager Events

```js
manager.on("GiveawayReady", (name) => {
  console.log(`${name} is Ready`);
});
manager.on("GiveawayStarted", (message, giveaway) => {
  // console.log("GiveawayStarted");
  message.reply(`Giveaway Started`);
});
manager.on("GiveawayWinner", (message, winners, giveaway) => {
  // console.log("GiveawayWinner");
  let Gwinners = winners.map((winner) => `<@${winner.userID}>`);
  message.channel.send(
    `${Gwinners} Won The \`${giveaway.prize}\` Giveaway Prize. Hosted By <@${giveaway.host}>`
  );

  winners.map(async (user) => {
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
```

# Bugs, glitches and issues

If you encounter any problems feel free to open an issue in our <a href="https://github.com/kabirsingh2004/@real@giveaways/issues">GitHub repository</a> or join the [Discord server](https://discord.gg/PcUVWApWN3).
