const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../config');
const { sendLog, logEmbed, successEmbed, errorEmbed } = require('../utils/logger');

// ─── /ban ────────────────────────────────────────────────────────────────────
const ban = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('🔨 Ban global un utilisateur sur les 3 serveurs')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName('utilisateur').setDescription('Utilisateur à bannir').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison du ban').setRequired(false))
    .addIntegerOption(o => o.setName('jours').setDescription('Supprimer les messages (jours, 0-7)').setMinValue(0).setMaxValue(7).setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getUser('utilisateur');
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const days = interaction.options.getInteger('jours') ?? 0;
    const moderator = interaction.user;

    const results = [];

    for (const guildConf of config.guilds) {
      try {
        const guild = await interaction.client.guilds.fetch(guildConf.id).catch(() => null);
        if (!guild) { results.push(`❌ **${guildConf.name}** — Serveur introuvable`); continue; }

        await guild.members.ban(target.id, { reason: `[BAN GLOBAL] ${reason} | Par ${moderator.tag}`, deleteMessageDays: days });
        results.push(`✅ **${guildConf.name}** — Banni avec succès`);

        const logEmb = logEmbed(
          'BAN GLOBAL',
          `**${target.tag}** (\`${target.id}\`) a été banni globalement.`,
          config.colors.ban,
          [
            { name: '👮 Modérateur', value: `${moderator.tag}`, inline: true },
            { name: '📋 Raison', value: reason, inline: true },
            { name: '🗑️ Messages supprimés', value: `${days} jour(s)`, inline: true },
          ]
        ).setThumbnail(target.displayAvatarURL());
        await sendLog(interaction.client, logEmb, guildConf.id);
      } catch (err) {
        results.push(`❌ **${guildConf.name}** — Erreur: ${err.message}`);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('🔨 Ban Global Exécuté')
      .setDescription(`**Utilisateur:** ${target.tag} (\`${target.id}\`)\n**Raison:** ${reason}\n\n${results.join('\n')}`)
      .setColor(config.colors.ban)
      .setThumbnail(target.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: `Exécuté par ${moderator.tag}` });

    await interaction.editReply({ embeds: [embed] });
  },
};

// ─── /kick ───────────────────────────────────────────────────────────────────
const kick = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('👢 Expulse un membre du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(o => o.setName('membre').setDescription('Membre à kick').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison du kick').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember('membre');
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const moderator = interaction.user;

    if (!target) return interaction.editReply({ embeds: [errorEmbed('Erreur', 'Membre introuvable.')] });
    if (!target.kickable) return interaction.editReply({ embeds: [errorEmbed('Erreur', 'Je ne peux pas kick ce membre.')] });

    try {
      await target.send({
        embeds: [new EmbedBuilder()
          .setTitle('👢 Vous avez été expulsé')
          .setDescription(`Vous avez été expulsé de **${interaction.guild.name}**`)
          .addFields({ name: '📋 Raison', value: reason })
          .setColor(config.colors.kick)
          .setTimestamp()]
      }).catch(() => {});

      await target.kick(`[KICK] ${reason} | Par ${moderator.tag}`);

      const logEmb = logEmbed('KICK', `**${target.user.tag}** a été expulsé.`, config.colors.kick, [
        { name: '👮 Modérateur', value: moderator.tag, inline: true },
        { name: '📋 Raison', value: reason, inline: true },
      ]);
      await sendLog(interaction.client, logEmb, interaction.guildId);

      await interaction.editReply({ embeds: [successEmbed('Kick effectué', `**${target.user.tag}** a été expulsé.\n📋 **Raison:** ${reason}`)] });
    } catch (err) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', err.message)] });
    }
  },
};

// ─── /mute ───────────────────────────────────────────────────────────────────
const mute = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('🔇 Réduit au silence un membre (timeout)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('membre').setDescription('Membre à mute').setRequired(true))
    .addStringOption(o => o.setName('duree').setDescription('Durée (ex: 10m, 1h, 1d)').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember('membre');
    const durationStr = interaction.options.getString('duree');
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const moderator = interaction.user;

    if (!target) return interaction.editReply({ embeds: [errorEmbed('Erreur', 'Membre introuvable.')] });

    const ms = parseDuration(durationStr);
    if (!ms || ms > 28 * 24 * 60 * 60 * 1000) {
      return interaction.editReply({ embeds: [errorEmbed('Durée invalide', 'Format: `10m`, `1h`, `2d` (max 28 jours)')] });
    }

    try {
      await target.timeout(ms, `[MUTE] ${reason} | Par ${moderator.tag}`);

      const logEmb = logEmbed('MUTE', `**${target.user.tag}** a été réduit au silence.`, config.colors.mute, [
        { name: '👮 Modérateur', value: moderator.tag, inline: true },
        { name: '⏱️ Durée', value: durationStr, inline: true },
        { name: '📋 Raison', value: reason, inline: true },
      ]);
      await sendLog(interaction.client, logEmb, interaction.guildId);

      await interaction.editReply({
        embeds: [successEmbed('Mute effectué', `**${target.user.tag}** est réduit au silence pour **${durationStr}**.\n📋 **Raison:** ${reason}`)],
      });
    } catch (err) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', err.message)] });
    }
  },
};

// ─── /staff ──────────────────────────────────────────────────────────────────
const staff = {
  data: new SlashCommandBuilder()
    .setName('staff')
    .setDescription('👥 Affiche le menu staff')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const embed = new EmbedBuilder()
      .setTitle('🛡️ Panneau Staff')
      .setDescription('Bienvenue dans le panneau de modération. Utilisez les boutons ci-dessous pour accéder aux outils.')
      .setColor(config.colors.primary)
      .addFields(
        { name: '🔨 Modération', value: '`/ban` `/kick` `/mute` `/unban` `/warn` `/clearwarn`', inline: false },
        { name: '🔧 Utilitaires', value: '`/clear` `/slowmode` `/lock` `/unlock` `/sondage`', inline: false },
        { name: '📊 Informations', value: '`/userinfo` `/serverinfo` `/roleinfo` `/avatar`', inline: false },
        { name: '🎵 Musique', value: '`/play` `/skip` `/stop` `/queue` `/join`', inline: false },
      )
      .setTimestamp()
      .setFooter({ text: `Accédé par ${interaction.user.tag}` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('staff_banliste').setLabel('Banliste').setEmoji('📋').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('staff_warns').setLabel('Avertissements').setEmoji('⚠️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('staff_stats').setLabel('Stats Modération').setEmoji('📊').setStyle(ButtonStyle.Primary),
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },
};

// ─── /unban ──────────────────────────────────────────────────────────────────
const unban = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('🔓 Débannit un utilisateur')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(o => o.setName('userid').setDescription('ID de l\'utilisateur').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const userId = interaction.options.getString('userid');
    const reason = interaction.options.getString('raison') || 'Aucune raison';

    try {
      const ban = await interaction.guild.bans.fetch(userId).catch(() => null);
      if (!ban) return interaction.editReply({ embeds: [errorEmbed('Erreur', 'Cet utilisateur n\'est pas banni.')] });

      await interaction.guild.members.unban(userId, `[UNBAN] ${reason} | Par ${interaction.user.tag}`);

      const logEmb = logEmbed('UNBAN', `**${ban.user.tag}** a été débanni.`, config.colors.success, [
        { name: '👮 Modérateur', value: interaction.user.tag, inline: true },
        { name: '📋 Raison', value: reason, inline: true },
      ]);
      await sendLog(interaction.client, logEmb, interaction.guildId);

      await interaction.editReply({ embeds: [successEmbed('Unban effectué', `**${ban.user.tag}** a été débanni.`)] });
    } catch (err) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', err.message)] });
    }
  },
};

// ─── /warn ───────────────────────────────────────────────────────────────────
const warns = new Map();

const warn = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('⚠️ Avertit un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getMember('membre');
    const reason = interaction.options.getString('raison');
    if (!target) return interaction.reply({ embeds: [errorEmbed('Erreur', 'Membre introuvable.')], ephemeral: true });

    const key = `${interaction.guildId}-${target.id}`;
    if (!warns.has(key)) warns.set(key, []);
    warns.get(key).push({ reason, moderator: interaction.user.tag, date: new Date().toLocaleDateString('fr-FR') });

    const count = warns.get(key).length;

    await target.send({
      embeds: [new EmbedBuilder()
        .setTitle('⚠️ Avertissement reçu')
        .setDescription(`Vous avez reçu un avertissement sur **${interaction.guild.name}**`)
        .addFields({ name: '📋 Raison', value: reason }, { name: '⚠️ Total', value: `${count} avertissement(s)` })
        .setColor(config.colors.warning)
        .setTimestamp()]
    }).catch(() => {});

    const logEmb = logEmbed('WARN', `**${target.user.tag}** a reçu un avertissement (#${count}).`, config.colors.warning, [
      { name: '👮 Modérateur', value: interaction.user.tag, inline: true },
      { name: '📋 Raison', value: reason, inline: true },
      { name: '⚠️ Total', value: `${count}`, inline: true },
    ]);
    await sendLog(interaction.client, logEmb, interaction.guildId);

    await interaction.reply({
      embeds: [successEmbed('Avertissement envoyé', `**${target.user.tag}** a été averti. **(${count} warn(s) total)**`)],
      ephemeral: true,
    });
  },
};

function parseDuration(str) {
  const regex = /^(\d+)(s|m|h|d)$/i;
  const match = str.match(regex);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const map = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return val * map[unit];
}

module.exports = { ban, kick, mute, staff, unban, warn };
