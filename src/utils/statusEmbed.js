const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const { formatDuration } = require('./logger');

const STAFF_ROLES = [
  { id: '1414249440998461544', name: 'Fondateur', emoji: '👑' },
  { id: '1466401507774693518', name: 'Co-Fondateur', emoji: '👑' },
  { id: '1466396441911234591', name: 'Administrateur', emoji: '🔧' },
  { id: '1466395493914509642', name: 'Administrateur Test', emoji: '🔧' },
  { id: '1466395451161841756', name: 'Moderateur', emoji: '🛡️' },
  { id: '1466395204432035862', name: 'Moderateur Test', emoji: '🛡️' },
  { id: '1414249442659270757', name: 'Support', emoji: '🎧' },
  { id: '1466395101126463632', name: 'Support Test', emoji: '🎧' },
];
const STAFF_TOTAL_ROLE = '1466396851711250556';

function getMusicManager() {
  return require('../music/MusicManager');
}

// Cherche le dernier message du bot dans un salon
async function findBotMessage(channel, client) {
  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    return messages.find(m => m.author.id === client.user.id && m.embeds.length > 0) || null;
  } catch (_) {
    return null;
  }
}

// ─── EMBED ETAT BOT ───────────────────────────────────────────────────────────
async function sendStatusEmbed(client) {
  for (const guildConf of config.guilds) {
    try {
      const channel = await client.channels.fetch(guildConf.statusChannel).catch(() => null);
      if (!channel) continue;

      const embed = await buildStatusEmbed(client, guildConf);
      const existing = await findBotMessage(channel, client);

      if (existing) {
        await existing.edit({ embeds: [embed] });
      } else {
        await channel.send({ embeds: [embed] });
      }
    } catch (err) {
      console.error(`[STATUS] Guild ${guildConf.id}: ${err.message}`);
    }
  }
}

async function buildStatusEmbed(client, guildConf) {
  const guild = await client.guilds.fetch(guildConf.id).catch(() => null);
  const uptime = formatDuration(Date.now() - config.startTime);
  const ws = client.ws.ping;

  await guild?.members.fetch().catch(() => {});

  const totalMembers = guild?.memberCount || 0;

  let musicStatus = null;
  try {
    const q = getMusicManager().get(guildConf.id);
    if (q?.current) musicStatus = q.current.title;
  } catch (_) {}

  const voiceChannels = guild?.channels.cache.filter(c => c.type === 2 && c.members.size > 0);
  let vocLines = [];
  if (voiceChannels?.size > 0) {
    for (const [, vc] of voiceChannels) {
      const humans = vc.members.filter(m => !m.user.bot);
      if (humans.size === 0) continue;
      vocLines.push(`**${vc.name}**`);
      humans.forEach(m => vocLines.push(`┃ ${m.user.username}`));
    }
  }

  const embed = new EmbedBuilder()
    .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
    .setTitle(`${client.user.username} — État du système`)
    .setColor(0x5865F2)
    .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
    .addFields({
      name: '\u200b',
      value: [
        `🟢 **Statut** \u3000 🛰️ **Latence** \u3000 ⏱️ **Uptime**`,
        `Opérationnel \u3000 ${ws}ms \u3000 ${uptime}`,
        `\u200b`,
        `🛡️ **Serveurs** \u3000 👥 **Utilisateurs** \u3000 🐛 **Bugs**`,
        `${client.guilds.cache.size} \u3000\u3000\u3000\u3000 ${totalMembers} \u3000\u3000\u3000\u3000\u3000 Aucun détecté`,
      ].join('\n'),
      inline: false,
    })
    .addFields({ name: '─────────────────────────────────────', value: '\u200b' })
    .addFields({
      name: '🎵 Activité vocale',
      value: vocLines.length > 0
        ? vocLines.join('\n').substring(0, 1024)
        : `${guild?.name || guildConf.name}\n*Personne en vocal*`,
      inline: false,
    })
    .setTimestamp()
    .setFooter({ text: `${guild?.name || guildConf.name} • Mis à jour` });

  if (musicStatus) {
    embed.addFields({ name: '🎶 Musique en cours', value: musicStatus });
  }

  return embed;
}

// ─── EMBED STAFF ──────────────────────────────────────────────────────────────
async function sendStaffEmbed(client) {
  try {
    const channel = await client.channels.fetch(config.staffChannel).catch(() => null);
    if (!channel) return;

    const guild = channel.guild;
    await guild.members.fetch().catch(() => {});

    const embed = await buildStaffEmbed(client, guild);
    const existing = await findBotMessage(channel, client);

    if (existing) {
      await existing.edit({ embeds: [embed] });
    } else {
      await channel.send({ embeds: [embed] });
    }

    console.log('[STATUS] Embed staff envoye/mis a jour.');
  } catch (err) {
    console.error(`[STAFF EMBED] ${err.message}`);
  }
}

async function buildStaffEmbed(client, guild) {
  const embed = new EmbedBuilder()
    .setTitle('👥 | Équipe Staff | Rôles & Membres |')
    .setDescription('*Mise à jour automatique toutes les quelques minutes.*')
    .setColor(0x5865F2)
    .setThumbnail(guild.iconURL({ size: 256 }) || client.user.displayAvatarURL())
    .setTimestamp()
    .setFooter({ text: `${guild.name} • Auto-update` });

  let totalStaff = 0;

  for (const roleDef of STAFF_ROLES) {
    const role = guild.roles.cache.get(roleDef.id);
    if (!role) continue;

    const members = guild.members.cache.filter(m => m.roles.cache.has(roleDef.id) && !m.user.bot);
    totalStaff += members.size;

    const memberList = members.size > 0
      ? [...members.values()].map(m => `<@${m.id}>`).join(' • ')
      : '*Aucun membre*';

    embed.addFields({
      name: `${roleDef.emoji} <@&${roleDef.id}> · ${members.size}`,
      value: `┃ ${memberList}`.substring(0, 1024),
      inline: false,
    });
  }

  embed.addFields({
    name: '📌 Staff total',
    value: `<@&${STAFF_TOTAL_ROLE}> — **${totalStaff}** membre(s)`,
    inline: false,
  });

  return embed;
}

module.exports = { sendStatusEmbed, sendStaffEmbed };