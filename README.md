# Real-Giveaway
Advance discord giveaways system with Support Slash/Message support

# Download

```cli
npm i @real/giveaways
------ or ---------------------
yarn add @real/giveaways
```
# Setting up

## Client values
```js
const GiveawaySystem = require("@real/giveaways");
const Discord = require('discord.js');

const client = new Discord.Client();
client.ManagerGiveaway = new GiveawaySystem(this, {
      embedColor: "#FF5498",
    });
```

## For Message commands

```js
manager.on("GiveawayReady", () => {

});
manager.on("GiveawayStarted", (message, giveaway) => {
  message.channel.send(`Giveaway Started`);
});
manager.on("GiveawayWinner", (giveaway, winners, member, msg) => {
  let Gwinners = winners.map((winner) => `<@${winner.userID}>`);
  msg.channel.send(
    `${Gwinners} Won The \`${giveaway.prize}\` Giveaway Prize. Hosted By <@${giveaway.host}>`
  );

  winners.map((user) => {
    msg.guild.members.cache
      .get(user.userID)
      .send(`You Won The Giveaway ${msg.url}`);
  });
});
manager.on("NoWinner", (giveaway, msg) => {
  msg.reply(`No One Won ${giveaway.prize}`);
});
manager.on("InvalidGiveaway", (member, data) => {
  member.send(`You are Joining in Ended Giveaway`);
});
manager.on("UserJoinGiveaway", (member, data) => {
  member.send(`You Joined ${data.prize} Giveaway`);
});
manager.on("UserLeftGiveaway", (member, data) => {
  member.send(`You Left ${data.prize} Giveaway`);
});
```

## For Slash
#### Just you have to send the interaction as a message.