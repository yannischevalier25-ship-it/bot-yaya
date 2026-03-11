const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const { sendLog } = require('../utils/logger');

function getManager() {
  return require('../music/MusicManager');
}

function logEmbed(color, icon, title, lines, fields = []) {
  const e = new EmbedBuilder()
    .setColor(color)
    .setDescription(`${icon} **${title}**\n\n${lines}`)
    .setTimestamp()
    .setFooter({ text: 'PixelHub Logs' });
  if (fields.length) e.addFields(fields);
  return e;
}

function registerEvents(client) {

  client.on('messageDelete', async (msg) => {
    if (!msg.guild || msg.author?.bot) return;
    const e = logEmbed(0xe74c3c, '🗑️', 'Message supprimé',
      `**Auteur :** ${msg.author?.tag} (\`${msg.author?.id}\`)\n**Salon :** <#${msg.channelId}>`,
      [{ name: '💬 Contenu', value: msg.content?.substring(0, 1000) || '*Inconnu*' }]
    );
    await sendLog(client, e, msg.guild.id);
  });

  client.on('messageUpdate', async (o, n) => {
    if (!o.guild || o.author?.bot || o.content === n.content) return;
    const e = logEmbed(0xf39c12, '✏️', 'Message modifié',
      `**Auteur :** ${o.author?.tag}\n**Salon :** <#${o.channelId}> — [Voir](${n.url})`,
      [
        { name: '📄 Avant', value: o.content?.substring(0, 500) || '*Inconnu*' },
        { name: '📝 Après', value: n.content?.substring(0, 500) || '*Inconnu*' },
      ]
    );
    await sendLog(client, e, o.guild.id);
  });

  client.on('guildMemberAdd', async (member) => {
    const e = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setAuthor({ name: `${member.user.tag} a rejoint`, iconURL: member.user.displayAvatarURL() })
      .setDescription(`<@${member.id}> vient d'arriver sur le serveur.`)
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '🆔 ID', value: `\`${member.id}\``, inline: true },
        { name: '📅 Compte créé', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '👥 Membres', value: `${member.guild.memberCount}`, inline: true },
      )
      .setTimestamp()
      .setFooter({ text: 'PixelHub Logs' });
    await sendLog(client, e, member.guild.id);
  });

  client.on('guildMemberRemove', async (member) => {
    const roles = member.roles.cache.filter(r => r.id !== member.guild.id).map(r => `<@&${r.id}>`).join(', ') || 'Aucun';
    const e = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setAuthor({ name: `${member.user.tag} a quitté`, iconURL: member.user.displayAvatarURL() })
      .setDescription(`<@${member.id}> a quitté le serveur.`)
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '🆔 ID', value: `\`${member.id}\``, inline: true },
        { name: '📅 Arrivé', value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Inconnu', inline: true },
        { name: '🎭 Rôles', value: roles.substring(0, 500), inline: false },
      )
      .setTimestamp()
      .setFooter({ text: 'PixelHub Logs' });
    await sendLog(client, e, member.guild.id);
  });

  client.on('guildBanAdd', async (ban) => {
    const e = new EmbedBuilder()
      .setColor(0xc0392b)
      .setAuthor({ name: `${ban.user.tag} banni`, iconURL: ban.user.displayAvatarURL() })
      .setDescription(`<@${ban.user.id}> a été banni du serveur.`)
      .addFields({ name: '📋 Raison', value: ban.reason || 'Aucune raison fournie' })
      .setTimestamp()
      .setFooter({ text: 'PixelHub Logs' });
    await sendLog(client, e, ban.guild.id);
  });

  client.on('guildBanRemove', async (ban) => {
    const e = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setAuthor({ name: `${ban.user.tag} débanni`, iconURL: ban.user.displayAvatarURL() })
      .setDescription(`<@${ban.user.id}> a été débanni.`)
      .setTimestamp()
      .setFooter({ text: 'PixelHub Logs' });
    await sendLog(client, e, ban.guild.id);
  });

  client.on('guildMemberUpdate', async (o, n) => {
    if (!o.communicationDisabledUntil && n.communicationDisabledUntil) {
      const e = logEmbed(0xe67e22, '🔇', 'Membre mis en timeout',
        `<@${n.id}> est en timeout jusqu'au <t:${Math.floor(n.communicationDisabledUntilTimestamp / 1000)}:F>`
      );
      await sendLog(client, e, n.guild.id);
    }
    if (o.communicationDisabledUntil && !n.communicationDisabledUntil) {
      const e = logEmbed(0x2ecc71, '🔊', 'Timeout levé', `<@${n.id}> n'est plus en timeout.`);
      await sendLog(client, e, n.guild.id);
    }

    const added = n.roles.cache.filter(r => !o.roles.cache.has(r.id));
    const removed = o.roles.cache.filter(r => !n.roles.cache.has(r.id));
    if (added.size > 0) {
      const e = logEmbed(0x2ecc71, '🎭', 'Rôle(s) ajouté(s)',
        `<@${n.id}> a reçu : ${added.map(r => `<@&${r.id}>`).join(', ')}`
      );
      await sendLog(client, e, n.guild.id);
    }
    if (removed.size > 0) {
      const e = logEmbed(0xe74c3c, '🎭', 'Rôle(s) retiré(s)',
        `<@${n.id}> a perdu : ${removed.map(r => `<@&${r.id}>`).join(', ')}`
      );
      await sendLog(client, e, n.guild.id);
    }
    if (o.nickname !== n.nickname) {
      const e = logEmbed(0x3498db, '📝', 'Surnom modifié',
        `<@${n.id}>\n**Avant :** \`${o.nickname || 'Aucun'}\`\n**Après :** \`${n.nickname || 'Aucun'}\``
      );
      await sendLog(client, e, n.guild.id);
    }
  });

  client.on('voiceStateUpdate', async (o, n) => {
    const member = n.member || o.member;
    if (!member || member.user.bot) return;
    if (!o.channelId && n.channelId) {
      const e = logEmbed(0x2ecc71, '🔊', 'Salon vocal rejoint',
        `<@${member.id}> a rejoint **${n.channel?.name}**`
      );
      await sendLog(client, e, n.guild.id);
    } else if (o.channelId && !n.channelId) {
      const e = logEmbed(0xe74c3c, '🔇', 'Salon vocal quitté',
        `<@${member.id}> a quitté **${o.channel?.name}**`
      );
      await sendLog(client, e, o.guild.id);
    } else if (o.channelId !== n.channelId) {
      const e = logEmbed(0x3498db, '🔄', 'Déplacement vocal',
        `<@${member.id}> : **${o.channel?.name}** → **${n.channel?.name}**`
      );
      await sendLog(client, e, n.guild.id);
    }
  });

  client.on('channelCreate', async (ch) => {
    if (!ch.guild) return;
    const e = logEmbed(0x2ecc71, '📁', 'Salon créé', `**${ch.name}** (\`${ch.id}\`)`);
    await sendLog(client, e, ch.guild.id);
  });

  client.on('channelDelete', async (ch) => {
    if (!ch.guild) return;
    const e = logEmbed(0xe74c3c, '📁', 'Salon supprimé', `**${ch.name}** (\`${ch.id}\`)`);
    await sendLog(client, e, ch.guild.id);
  });

  client.on('roleCreate', async (role) => {
    const e = logEmbed(0x2ecc71, '🎭', 'Rôle créé', `<@&${role.id}> (\`${role.id}\`)`);
    await sendLog(client, e, role.guild.id);
  });

  client.on('roleDelete', async (role) => {
    const e = logEmbed(0xe74c3c, '🎭', 'Rôle supprimé', `**${role.name}** (\`${role.id}\`)`);
    await sendLog(client, e, role.guild.id);
  });

  client.on('guildUpdate', async (o, n) => {
    const changes = [];
    if (o.name !== n.name) changes.push(`**Nom :** \`${o.name}\` → \`${n.name}\``);
    if (o.iconURL() !== n.iconURL()) changes.push('**Icône** modifiée');
    if (!changes.length) return;
    const e = logEmbed(0xf39c12, '⚙️', 'Serveur modifié', changes.join('\n'));
    await sendLog(client, e, n.id);
  });

  client.on('inviteCreate', async (invite) => {
    if (!invite.guild) return;
    const e = logEmbed(0x3498db, '🔗', 'Invitation créée',
      `Code : \`${invite.code}\` | Salon : <#${invite.channelId}>`,
      [
        { name: '👤 Créé par', value: invite.inviter?.tag || 'Inconnu', inline: true },
        { name: '⏰ Expire', value: invite.maxAge ? `Dans ${invite.maxAge}s` : 'Jamais', inline: true },
        { name: '🔢 Max', value: `${invite.maxUses || '∞'}`, inline: true },
      ]
    );
    await sendLog(client, e, invite.guild.id);
  });

  // Boutons musique
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    const { customId, guildId } = interaction;

    try {
      const { AudioPlayerStatus } = require('@discordjs/voice');
      const musicManager = getManager();
      const queue = musicManager.get(guildId);

      if (customId === 'music_pause') {
        const isPaused = queue.getStatus() === AudioPlayerStatus.Paused;
        isPaused ? queue.resume() : queue.pause();
        await interaction.reply({ content: isPaused ? '▶️ Reprise' : '⏸️ Pause', flags: 64 });
        await queue._updatePlayerMessage();
      } else if (customId === 'music_skip') {
        queue.skip();
        await interaction.reply({ content: '⏭️ Skippé !', flags: 64 });
      } else if (customId === 'music_stop') {
        queue.stop();
        musicManager.delete(guildId);
        await interaction.reply({ content: '⏹️ Arrêté.', flags: 64 });
      } else if (customId === 'music_loop') {
        const state = queue.toggleLoop();
        await interaction.reply({ content: `🔁 Loop ${state ? 'activé' : 'désactivé'}`, flags: 64 });
        await queue._updatePlayerMessage();
      } else if (customId === 'staff_banliste') {
        const bans = await interaction.guild.bans.fetch();
        const list = bans.size > 0
          ? [...bans.values()].slice(0, 10).map(b => `• <@${b.user.id}> — ${b.reason || 'Sans raison'}`).join('\n')
          : '*Aucun banni.*';
        const e = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle(`📋  Banliste — ${bans.size} entrée(s)`)
          .setDescription(list)
          .setTimestamp();
        await interaction.reply({ embeds: [e], flags: 64 });
      }
    } catch (err) {
      console.error('[BUTTON]', err.message);
      if (!interaction.replied) await interaction.reply({ content: 'Erreur.', flags: 64 }).catch(() => {});
    }
  });
}

module.exports = { registerEvents };