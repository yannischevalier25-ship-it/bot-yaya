const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const playdl = require('play-dl');
const config = require('../config');
const { errorEmbed, successEmbed } = require('../utils/logger');

function mm() { return require('../music/MusicManager'); }

const play = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('🎵 Joue une musique (titre ou lien YouTube/SoundCloud)')
    .addStringOption(o => o.setName('query').setDescription('Titre ou URL').setRequired(true)),

  async execute(interaction) {
    // deferReply déjà fait dans index.js
    const query = interaction.options.getString('query');
    const voiceChannel = interaction.member.voice?.channel;

    if (!voiceChannel) {
      return interaction.editReply({ embeds: [errorEmbed('Salon vocal requis', 'Rejoins un salon vocal avant de lancer une musique.')] });
    }

    const queue = mm().get(interaction.guildId);

    if (!queue.connection) {
      try {
        await queue.join(voiceChannel, interaction.channel);
      } catch (err) {
        return interaction.editReply({ embeds: [errorEmbed('Connexion impossible', err.message)] });
      }
    }

    try {
      let track;

      if (query.startsWith('http')) {
        const validated = playdl.yt_validate(query);
        if (validated === 'video') {
          const info = await playdl.video_info(query);
          track = {
            title: info.video_details.title,
            url: query,
            duration: fmtSec(info.video_details.durationInSec),
            thumbnail: info.video_details.thumbnails?.[0]?.url,
            requestedBy: interaction.user.tag,
          };
        } else if (query.includes('soundcloud')) {
          const info = await playdl.soundcloud(query);
          track = {
            title: info.name,
            url: query,
            duration: fmtSec(Math.floor(info.durationInMs / 1000)),
            thumbnail: info.thumbnail,
            requestedBy: interaction.user.tag,
          };
        } else {
          return interaction.editReply({ embeds: [errorEmbed('URL non supportée', 'Seuls YouTube et SoundCloud sont supportés.')] });
        }
      } else {
        const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 1 });
        if (!results.length) {
          return interaction.editReply({ embeds: [errorEmbed('Aucun résultat', `Rien trouvé pour **${query}**`)] });
        }
        const r = results[0];
        track = {
          title: r.title,
          url: r.url,
          duration: fmtSec(r.durationInSec),
          thumbnail: r.thumbnails?.[0]?.url,
          requestedBy: interaction.user.tag,
        };
      }

      const wasPlaying = !!queue.current;
      await queue.addTrack(track, interaction.channel);

      if (wasPlaying) {
        const e = new EmbedBuilder()
          .setColor(0xb659f5)
          .setDescription(`### ➕  Ajouté à la file\n**[${track.title}](${track.url})**`)
          .addFields(
            { name: '⏱️ Durée', value: track.duration, inline: true },
            { name: '📋 Position', value: `#${queue.tracks.length}`, inline: true },
          )
          .setThumbnail(track.thumbnail)
          .setTimestamp()
          .setFooter({ text: `Demandé par ${interaction.user.tag}` });
        await interaction.editReply({ embeds: [e] });
      } else {
        const msg = await interaction.editReply({
          embeds: [queue.buildEmbed()],
          components: [queue.buildButtons()],
        });
        queue.playerMessage = msg;
      }
    } catch (err) {
      console.error('[PLAY ERROR]', err);
      await interaction.editReply({ embeds: [errorEmbed('Erreur', `\`${err.message}\``)] });
    }
  },
};

const join = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('🔊 Rejoint ton salon vocal'),

  async execute(interaction) {
    // deferReply déjà fait dans index.js
    const voiceChannel = interaction.member.voice?.channel;
    if (!voiceChannel) {
      return interaction.editReply({ embeds: [errorEmbed('Salon vocal requis', 'Rejoins un salon vocal !')] });
    }

    const queue = mm().get(interaction.guildId);

    if (queue.connection && queue.connection.joinConfig?.channelId === voiceChannel.id) {
      return interaction.editReply({
        embeds: [successEmbed('Déjà connecté !', `Je suis déjà dans **${voiceChannel.name}**`)]
      });
    }

    try {
      await queue.join(voiceChannel, interaction.channel);
      await interaction.editReply({
        embeds: [successEmbed('Connecté !', `Le bot a rejoint **${voiceChannel.name}** ✅`)]
      });
    } catch (err) {
      console.error('[JOIN ERROR]', err.message);
      await interaction.editReply({
        embeds: [errorEmbed('Erreur de connexion', err.message)]
      });
    }
  },
};

const stop = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('⏹️ Arrête la musique et déconnecte le bot'),

  async execute(interaction) {
    // deferReply déjà fait dans index.js
    mm().delete(interaction.guildId);
    await interaction.editReply({ embeds: [successEmbed('Arrêté', 'Musique stoppée et bot déconnecté.')] });
  },
};

const skip = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('⏭️ Passe à la musique suivante'),

  async execute(interaction) {
    // deferReply déjà fait dans index.js
    const queue = mm().get(interaction.guildId);
    if (!queue.current) {
      return interaction.editReply({ embeds: [errorEmbed('Rien en cours', 'Aucune musique en cours de lecture.')] });
    }
    queue.skip();
    await interaction.editReply({ embeds: [successEmbed('Skippé !', 'Passage à la prochaine musique.')] });
  },
};

const queue = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('📋 Affiche la file d\'attente'),

  async execute(interaction) {
    // Pas de deferReply — cette commande fait son propre reply()
    const q = mm().get(interaction.guildId);
    const e = new EmbedBuilder()
      .setColor(0xb659f5)
      .setTitle('📋  File d\'attente')
      .setTimestamp()
      .setFooter({ text: `${q.tracks.length + (q.current ? 1 : 0)} titre(s) • PixelHub` });

    if (!q.current) {
      e.setDescription('> Aucune musique en cours.');
    } else {
      e.setDescription(`**▶️ En cours**\n> [${q.current.title}](${q.current.url})\n> *${q.current.requestedBy} • ${q.current.duration}*`);
      if (q.tracks.length) {
        const list = q.tracks.slice(0, 10)
          .map((t, i) => `\`${i + 1}.\` [${t.title}](${t.url}) — *${t.requestedBy}* \`${t.duration}\``)
          .join('\n');
        e.addFields({ name: '⏭️ Suivants', value: list });
      }
    }
    await interaction.reply({ embeds: [e] });
  },
};

const volume = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('🔊 Règle le volume (0-100)')
    .addIntegerOption(o => o.setName('valeur').setDescription('Volume 0-100').setMinValue(0).setMaxValue(100).setRequired(true)),

  async execute(interaction) {
    // deferReply déjà fait dans index.js
    const val = interaction.options.getInteger('valeur');
    mm().get(interaction.guildId).setVolume(val);
    await interaction.editReply({ embeds: [successEmbed('Volume réglé', `Volume défini à **${val}%**`)] });
  },
};

function fmtSec(sec) {
  if (!sec) return '?:??';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

module.exports = { play, join, stop, skip, queue, volume };
