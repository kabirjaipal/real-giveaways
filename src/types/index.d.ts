import { Channel, GuildMember, Message } from "discord.js";

export interface ManagerOptions {
  embedColor: string;
}

export interface GiveawayStartOptions {
  channel: Channel;
  prize: string;
  winnerCount: number;
  duration: string;
  member: GuildMember;
}

export interface GiveawayOptions {
  message: Message;
  messageId: string;
  channelId: string;
  guildId: string;
  prize: string;
  started: string;
  entry: Array;
  entered: number;
  winCount: number;
  endTime: string;
  host: string;
  ended: boolean;
}
