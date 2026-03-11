const { EmbedBuilder } = require('discord.js');
const config = require('../config');

async function sendLog(client, embed, guildId = null) {
  const targets = guildId
    ? config.guilds.filter(g => g.id === guildId)
    : config.guilds;

  for (const g of targets) {
    try {
      const channel = await client.channels.fetch(g.logChannel).catch(() => null);
      if (channel) await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(`[LOG ERROR] Guild ${g.id}: ${err.message}`);
    }
  }
}

function baseEmbed(color) {
  return new EmbedBuilder()
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: `PixelHub • v${config.version}` });
}

function logEmbed(title, description, color = 0x2b2d31, fields = []) {
  const e = baseEmbed(color)
    .setDescription(`**${title}**\n\n${description}`);
  if (fields.length) e.addFields(fields);
  return e;
}

function successEmbed(title, description, fields = []) {
  const e = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setDescription(`### ✅  ${title}\n${description}`)
    .setTimestamp()
    .setFooter({ text: `PixelHub • v${config.version}` });
  if (fields.length) e.addFields(fields);
  return e;
}

function errorEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0xe74c3c)
    .setDescription(`### ❌  ${title}\n${description}`)
    .setTimestamp()
    .setFooter({ text: `PixelHub • v${config.version}` });
}

function infoEmbed(title, description, fields = []) {
  const e = new EmbedBuilder()
    .setColor(0x3498db)
    .setDescription(`### ℹ️  ${title}\n${description}`)
    .setTimestamp()
    .setFooter({ text: `PixelHub • v${config.version}` });
  if (fields.length) e.addFields(fields);
  return e;
}

function warnEmbed(title, description, fields = []) {
  const e = new EmbedBuilder()
    .setColor(0xf39c12)
    .setDescription(`### ⚠️  ${title}\n${description}`)
    .setTimestamp()
    .setFooter({ text: `PixelHub • v${config.version}` });
  if (fields.length) e.addFields(fields);
  return e;
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}j ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

module.exports = { sendLog, logEmbed, successEmbed, errorEmbed, infoEmbed, warnEmbed, formatDuration };