const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require('discord.js');
const config = require('../config');
const { successEmbed, errorEmbed, infoEmbed, warnEmbed, sendLog, logEmbed, formatDuration } = require('../utils/logger');

// ─── /clear ──────────────────────────────────────────────────────────────────
const clear = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('🧹 Supprime des messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o => o.setName('nombre').setDescription('Nombre de messages (1-100)').setMinValue(1).setMaxValue(100).setRequired(true))
    .addUserOption(o => o.setName('utilisateur').setDescription('Filtrer par utilisateur').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const amount = interaction.options.getInteger('nombre');
    const user = interaction.options.getUser('utilisateur');

    let messages = await interaction.channel.messages.fetch({ limit: 100 });
    if (user) messages = messages.filter(m => m.author.id === user.id);
    const toDelete = [...messages.values()].slice(0, amount);

    const deleted = await interaction.channel.bulkDelete(toDelete, true);

    const logEmb = logEmbed('CLEAR', `**${deleted.size}** messages supprimés dans <#${interaction.channelId}>`, config.colors.warning, [
      { name: '👮 Modérateur', value: interaction.user.tag, inline: true },
      { name: '🗑️ Supprimés', value: `${deleted.size}`, inline: true },
      { name: '👤 Filtre', value: user?.tag || 'Aucun', inline: true },
    ]);
    await sendLog(interaction.client, logEmb, interaction.guildId);

    await interaction.editReply({ embeds: [successEmbed('Messages supprimés', `**${deleted.size}** messages ont été supprimés.`)] });
  },
};

// ─── /slowmode ───────────────────────────────────────────────────────────────
const slowmode = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('🐢 Définit le slowmode du salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(o => o.setName('secondes').setDescription('0 pour désactiver').setMinValue(0).setMaxValue(21600).setRequired(true)),

  async execute(interaction) {
    const sec = interaction.options.getInteger('secondes');
    await interaction.channel.setRateLimitPerUser(sec);
    const msg = sec === 0 ? 'Slowmode désactivé.' : `Slowmode réglé à **${sec}s**.`;
    await interaction.reply({ embeds: [successEmbed('Slowmode', msg)], ephemeral: true });
  },
};

// ─── /lock / /unlock ─────────────────────────────────────────────────────────
const lock = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('🔒 Verrouille le salon actuel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false)),

  async execute(interaction) {
    const reason = interaction.options.getString('raison') || 'Aucune raison';
    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
    const embed = new EmbedBuilder()
      .setTitle('🔒 Salon verrouillé')
      .setDescription(`Ce salon a été verrouillé par ${interaction.user}.\n📋 **Raison:** ${reason}`)
      .setColor(config.colors.error)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
    await sendLog(interaction.client, logEmbed('LOCK', `Salon <#${interaction.channelId}> verrouillé`, config.colors.error, [{ name: '📋 Raison', value: reason }]), interaction.guildId);
  },
};

const unlock = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('🔓 Déverrouille le salon actuel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
    const embed = new EmbedBuilder().setTitle('🔓 Salon déverrouillé').setDescription(`Salon déverrouillé par ${interaction.user}.`).setColor(config.colors.success).setTimestamp();
    await interaction.reply({ embeds: [embed] });
    await sendLog(interaction.client, logEmbed('UNLOCK', `Salon <#${interaction.channelId}> déverrouillé`, config.colors.success), interaction.guildId);
  },
};

// ─── /userinfo ───────────────────────────────────────────────────────────────
const userinfo = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('👤 Affiche les infos d\'un utilisateur')
    .addUserOption(o => o.setName('utilisateur').setDescription('Utilisateur').setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getMember('utilisateur') || interaction.member;
    const user = target.user;

    const roles = target.roles.cache.filter(r => r.id !== interaction.guild.id).map(r => `<@&${r.id}>`).join(', ') || 'Aucun';

    const embed = new EmbedBuilder()
      .setTitle(`👤 Profil — ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .setColor(target.displayHexColor || config.colors.primary)
      .addFields(
        { name: '🆔 ID', value: `\`${user.id}\``, inline: true },
        { name: '🤖 Bot', value: user.bot ? '✅ Oui' : '❌ Non', inline: true },
        { name: '📅 Compte créé', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`, inline: true },
        { name: '🚪 A rejoint', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:D>`, inline: true },
        { name: `🎭 Rôles (${target.roles.cache.size - 1})`, value: roles.length > 1024 ? roles.substring(0, 1020) + '...' : roles },
        { name: '🔝 Rôle principal', value: `<@&${target.roles.highest.id}>`, inline: true },
        { name: '🔇 En timeout', value: target.communicationDisabledUntil ? '✅ Oui' : '❌ Non', inline: true },
      )
      .setTimestamp()
      .setFooter({ text: `Demandé par ${interaction.user.tag}` });

    await interaction.reply({ embeds: [embed] });
  },
};

// ─── /serverinfo ─────────────────────────────────────────────────────────────
const serverinfo = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('🏠 Affiche les infos du serveur'),

  async execute(interaction) {
    const g = interaction.guild;
    await g.members.fetch();

    const embed = new EmbedBuilder()
      .setTitle(`🏠 ${g.name}`)
      .setThumbnail(g.iconURL({ size: 256 }))
      .setColor(config.colors.primary)
      .addFields(
        { name: '🆔 ID', value: `\`${g.id}\``, inline: true },
        { name: '👑 Propriétaire', value: `<@${g.ownerId}>`, inline: true },
        { name: '📅 Créé', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`, inline: true },
        { name: '👥 Membres', value: `${g.memberCount}`, inline: true },
        { name: '💬 Salons', value: `${g.channels.cache.size}`, inline: true },
        { name: '🎭 Rôles', value: `${g.roles.cache.size}`, inline: true },
        { name: '😀 Emojis', value: `${g.emojis.cache.size}`, inline: true },
        { name: '🔒 Vérification', value: g.verificationLevel.toString(), inline: true },
        { name: '🚀 Boost', value: `Niveau ${g.premiumTier} — ${g.premiumSubscriptionCount || 0} boost(s)`, inline: true },
      )
      .setTimestamp()
      .setFooter({ text: `Demandé par ${interaction.user.tag}` });

    await interaction.reply({ embeds: [embed] });
  },
};

// ─── /avatar ─────────────────────────────────────────────────────────────────
const avatar = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('🖼️ Affiche l\'avatar d\'un utilisateur')
    .addUserOption(o => o.setName('utilisateur').setDescription('Utilisateur').setRequired(false)),

  async execute(interaction) {
    const user = interaction.options.getUser('utilisateur') || interaction.user;
    const embed = new EmbedBuilder()
      .setTitle(`🖼️ Avatar — ${user.tag}`)
      .setImage(user.displayAvatarURL({ size: 1024, extension: 'png' }))
      .setColor(config.colors.primary)
      .addFields(
        { name: '📥 Liens', value: `[PNG](${user.displayAvatarURL({ size: 1024, extension: 'png' })}) | [WEBP](${user.displayAvatarURL({ size: 1024, extension: 'webp' })})` },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

// ─── /sondage ────────────────────────────────────────────────────────────────
const sondage = {
  data: new SlashCommandBuilder()
    .setName('sondage')
    .setDescription('📊 Crée un sondage')
    .addStringOption(o => o.setName('question').setDescription('Question du sondage').setRequired(true))
    .addStringOption(o => o.setName('choix1').setDescription('Choix 1').setRequired(false))
    .addStringOption(o => o.setName('choix2').setDescription('Choix 2').setRequired(false))
    .addStringOption(o => o.setName('choix3').setDescription('Choix 3').setRequired(false))
    .addStringOption(o => o.setName('choix4').setDescription('Choix 4').setRequired(false)),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const choices = [1, 2, 3, 4].map(i => interaction.options.getString(`choix${i}`)).filter(Boolean);

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${question}`)
      .setColor(config.colors.primary)
      .setTimestamp()
      .setFooter({ text: `Sondage créé par ${interaction.user.tag}` });

    let emojis;
    if (choices.length === 0) {
      embed.setDescription('✅ **Oui**\n❌ **Non**');
      emojis = ['✅', '❌'];
    } else {
      const nums = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
      embed.setDescription(choices.map((c, i) => `${nums[i]} **${c}**`).join('\n'));
      emojis = nums.slice(0, choices.length);
    }

    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    for (const e of emojis) await msg.react(e);
  },
};

// ─── /roleinfo ───────────────────────────────────────────────────────────────
const roleinfo = {
  data: new SlashCommandBuilder()
    .setName('roleinfo')
    .setDescription('🎭 Affiche les infos d\'un rôle')
    .addRoleOption(o => o.setName('role').setDescription('Rôle').setRequired(true)),

  async execute(interaction) {
    const role = interaction.options.getRole('role');
    await interaction.guild.members.fetch();
    const memberCount = interaction.guild.members.cache.filter(m => m.roles.cache.has(role.id)).size;

    const perms = role.permissions.toArray().slice(0, 10).map(p => `\`${p}\``).join(', ') || 'Aucune';

    const embed = new EmbedBuilder()
      .setTitle(`🎭 Rôle — ${role.name}`)
      .setColor(role.color || config.colors.primary)
      .addFields(
        { name: '🆔 ID', value: `\`${role.id}\``, inline: true },
        { name: '🎨 Couleur', value: role.hexColor, inline: true },
        { name: '👥 Membres', value: `${memberCount}`, inline: true },
        { name: '📌 Épinglé', value: role.hoist ? '✅ Oui' : '❌ Non', inline: true },
        { name: '🔐 Mentionnable', value: role.mentionable ? '✅ Oui' : '❌ Non', inline: true },
        { name: '📅 Créé', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:D>`, inline: true },
        { name: '🔑 Permissions (10 premières)', value: perms },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

// ─── /ping ───────────────────────────────────────────────────────────────────
const ping = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('🏓 Affiche la latence du bot'),

  async execute(interaction) {
    const sent = await interaction.reply({ content: 'Calcul en cours...', fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const ws = interaction.client.ws.ping;

    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong !')
      .setColor(latency < 100 ? config.colors.success : latency < 250 ? config.colors.warning : config.colors.error)
      .addFields(
        { name: '⚡ Latence API', value: `\`${latency}ms\``, inline: true },
        { name: '💓 WebSocket', value: `\`${ws}ms\``, inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed] });
  },
};

// ─── /botinfo ────────────────────────────────────────────────────────────────
const botinfo = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('🤖 Affiche les informations du bot'),

  async execute(interaction) {
    const client = interaction.client;
    const uptime = formatDuration(Date.now() - config.startTime);
    const totalMembers = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);

    const embed = new EmbedBuilder()
      .setTitle('🤖 Informations du Bot')
      .setThumbnail(client.user.displayAvatarURL())
      .setColor(config.colors.primary)
      .addFields(
        { name: '🏷️ Nom', value: client.user.tag, inline: true },
        { name: '🆔 ID', value: `\`${client.user.id}\``, inline: true },
        { name: '⏱️ Uptime', value: uptime, inline: true },
        { name: '🌐 Serveurs', value: `${client.guilds.cache.size}`, inline: true },
        { name: '👥 Membres totaux', value: `${totalMembers}`, inline: true },
        { name: '📦 Version', value: `v${config.version}`, inline: true },
        { name: '🔄 Dernier update', value: config.lastUpdate, inline: true },
        { name: '🟢 Status', value: '`En ligne`', inline: true },
        { name: '🛠️ Discord.js', value: `v${require('discord.js').version}`, inline: true },
      )
      .setTimestamp()
      .setFooter({ text: `Demandé par ${interaction.user.tag}` });

    await interaction.reply({ embeds: [embed] });
  },
};

// ─── /giveaway ───────────────────────────────────────────────────────────────
const giveaway = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('🎉 Lance un giveaway')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('prix').setDescription('Prix du giveaway').setRequired(true))
    .addStringOption(o => o.setName('duree').setDescription('Durée (ex: 1h, 1d)').setRequired(true))
    .addIntegerOption(o => o.setName('gagnants').setDescription('Nombre de gagnants').setMinValue(1).setMaxValue(10).setRequired(false)),

  async execute(interaction) {
    const prize = interaction.options.getString('prix');
    const durationStr = interaction.options.getString('duree');
    const winners = interaction.options.getInteger('gagnants') || 1;

    const ms = parseDuration(durationStr);
    if (!ms) return interaction.reply({ embeds: [errorEmbed('Durée invalide', 'Utilisez le format: `10m`, `1h`, `2d`')], ephemeral: true });

    const endTime = Date.now() + ms;

    const embed = new EmbedBuilder()
      .setTitle('🎉 GIVEAWAY !')
      .setDescription(`**Prix:** ${prize}\n\nRéagissez avec 🎉 pour participer !\n\n⏰ **Fin:** <t:${Math.floor(endTime / 1000)}:R>`)
      .setColor(config.colors.primary)
      .addFields(
        { name: '🏆 Gagnants', value: `${winners}`, inline: true },
        { name: '👤 Organisé par', value: interaction.user.tag, inline: true },
      )
      .setTimestamp(new Date(endTime))
      .setFooter({ text: `Se termine le` });

    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    await msg.react('🎉');

    setTimeout(async () => {
      try {
        const updatedMsg = await msg.fetch();
        const reaction = updatedMsg.reactions.cache.get('🎉');
        if (!reaction) return;

        const users = await reaction.users.fetch();
        const eligible = users.filter(u => !u.bot);

        if (eligible.size === 0) {
          await msg.reply({ embeds: [warnEmbed('Giveaway terminé', `Personne n'a participé au giveaway pour **${prize}**. 😔`)] });
          return;
        }

        const shuffled = [...eligible.values()].sort(() => Math.random() - 0.5);
        const picked = shuffled.slice(0, Math.min(winners, shuffled.length));
        const mentions = picked.map(u => `<@${u.id}>`).join(', ');

        const winEmbed = new EmbedBuilder()
          .setTitle('🎉 Giveaway Terminé !')
          .setDescription(`**Prix:** ${prize}\n\n🏆 **Gagnant(s):** ${mentions}\nFélicitations !`)
          .setColor(config.colors.success)
          .setTimestamp();

        await msg.reply({ content: mentions, embeds: [winEmbed] });
      } catch (err) {
        console.error('[GIVEAWAY]', err);
      }
    }, ms);
  },
};

// ─── /embed ──────────────────────────────────────────────────────────────────
const embed = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('📝 Crée et envoie un embed personnalisé')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('titre').setDescription('Titre').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Description').setRequired(true))
    .addStringOption(o => o.setName('couleur').setDescription('Couleur hex (ex: #5865F2)').setRequired(false))
    .addStringOption(o => o.setName('image').setDescription('URL image').setRequired(false)),

  async execute(interaction) {
    const titre = interaction.options.getString('titre');
    const description = interaction.options.getString('description');
    const couleurStr = interaction.options.getString('couleur') || '#5865F2';
    const image = interaction.options.getString('image');

    const couleur = parseInt(couleurStr.replace('#', ''), 16) || config.colors.primary;

    const emb = new EmbedBuilder()
      .setTitle(titre)
      .setDescription(description)
      .setColor(couleur)
      .setTimestamp()
      .setFooter({ text: `Posté par ${interaction.user.tag}` });

    if (image) emb.setImage(image);

    await interaction.channel.send({ embeds: [emb] });
    await interaction.reply({ embeds: [successEmbed('Embed envoyé !', 'L\'embed a été envoyé dans ce salon.')], ephemeral: true });
  },
};

function parseDuration(str) {
  const regex = /^(\d+)(s|m|h|d)$/i;
  const match = str.match(regex);
  if (!match) return null;
  const val = parseInt(match[1]);
  const map = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return val * map[match[2].toLowerCase()];
}

module.exports = { clear, slowmode, lock, unlock, userinfo, serverinfo, avatar, sondage, roleinfo, ping, botinfo, giveaway, embed };
