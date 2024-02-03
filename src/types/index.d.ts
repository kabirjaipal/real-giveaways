import {
  Channel,
  Emoji,
  Guild,
  GuildChannel,
  GuildMember,
  Message,
} from "discord.js";

export interface ManagerOptions {
  embedColor: string;
  pingEveryone: boolean;
  emoji: Emoji;
}

export interface GiveawayStartOptions {
  channel: Channel;
  prize: string;
  winnerCount: number;
  duration: string;
  member: GuildMember;
}

export interface entryOption {
  userID: string;
  guildID: string;
  messageID: string;
}

export interface GiveawayOptions {
  message: Message;
  messageId: string;
  channelId: string;
  guildId: string;
  prize: string;
  started: string;
  entry: entryOption[];
  entered: number;
  winCount: number;
  endTime: string;
  hostedBy: string;
  ended: boolean;
  winners: [];
  paused: boolean;
}

export interface fetchGCMReturnType {
  guild: Guild;
  channel: GuildChannel;
  message: Message;
}
