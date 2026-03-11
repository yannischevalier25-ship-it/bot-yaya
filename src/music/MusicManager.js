const {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  NoSubscriberBehavior,
  getVoiceConnection,
} = require('@discordjs/voice');
const playdl = require('play-dl');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');

async function getStream(url) {
  try {
    return await playdl.stream(url, { quality: 2, discordPlayerCompatibility: true });
  } catch {
    return await playdl.stream(url, { quality: 0 });
  }
}

class MusicQueue {
  constructor(guildId) {
    this.guildId = guildId;
    this.tracks = [];
    this.current = null;
    this.connection = null;
    this.playerMessage = null;
    this.loop = false;
    this.volume = 0.5;

    this.player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Play },
    });

    this.player.on(AudioPlayerStatus.Idle, () => this._next());
    this.player.on('error', err => {
      console.error('[PLAYER ERROR]', err.message);
      this._next();
    });
  }

  async _next() {
    if (this.loop && this.current) return this._play(this.current);
    if (this.tracks.length > 0) {
      this.current = this.tracks.shift();
      return this._play(this.current);
    }
    this.current = null;
    this._updateEmbed();
  }

  async _play(track) {
    try {
      console.log(`[MUSIC] Playing: ${track.title}`);
      const stream = await getStream(track.url);
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true,
      });
      resource.volume?.setVolume(this.volume);
      this.player.play(resource);
      this._updateEmbed();
    } catch (err) {
      console.error(`[MUSIC] Play error: ${err.message}`);
      if (this.textChannel) {
        this.textChannel.send(`❌ Erreur: \`${err.message}\``).catch(() => {});
      }
      setTimeout(() => this._next(), 1000);
    }
  }

  async join(voiceChannel, textChannel) {
    // Detruire proprement l'ancienne connexion
    const existing = getVoiceConnection(voiceChannel.guild.id);
    if (existing) {
      existing.destroy();
      await new Promise(r => setTimeout(r, 1000));
    }
    if (this.connection) {
      try { this.connection.destroy(); } catch (_) {}
      this.connection = null;
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`[MUSIC] Joining ${voiceChannel.name}`);

    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
      debug: true,
    });

    this.connection.on('stateChange', (o, n) => {
      console.log(`[VOICE] ${o.status} -> ${n.status}`);
    });

    this.connection.on('error', err => {
      console.error('[CONNECTION ERROR]', err.message);
    });

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.log('[VOICE] Disconnected - attempting reconnect...');
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5000),
        ]);
        console.log('[VOICE] Reconnected!');
      } catch {
        console.log('[VOICE] Reconnect failed.');
        try { this.connection.destroy(); } catch (_) {}
        this.connection = null;
      }
    });

    // Attendre Ready avec retry
    let attempts = 0;
    while (attempts < 3) {
      try {
        await entersState(this.connection, VoiceConnectionStatus.Ready, 15000);
        console.log('[VOICE] Ready!');
        break;
      } catch (err) {
        attempts++;
        console.log(`[VOICE] Attempt ${attempts} failed: ${err.message}`);
        if (attempts >= 3) {
          try { this.connection.destroy(); } catch (_) {}
          this.connection = null;
          throw new Error('Impossible de rejoindre le salon vocal après 3 tentatives.');
        }
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    this.connection.subscribe(this.player);
    this.textChannel = textChannel;
    return this.connection;
  }

  async addTrack(track, textChannel) {
    if (textChannel) this.textChannel = textChannel;
    this.tracks.push(track);
    if (!this.current) {
      this.current = this.tracks.shift();
      await this._play(this.current);
    }
  }

  skip() { this.player.stop(true); }

  stop() {
    this.tracks = [];
    this.current = null;
    this.loop = false;
    this.player.stop(true);
    if (this.connection) {
      try { this.connection.destroy(); } catch (_) {}
      this.connection = null;
    }
  }

  pause() { this.player.pause(true); }
  resume() { this.player.unpause(); }
  toggleLoop() { this.loop = !this.loop; return this.loop; }
  setVolume(v) { this.volume = v / 100; }
  getStatus() { return this.player.state.status; }

  buildEmbed() {
    const track = this.current;
    const e = new EmbedBuilder()
      .setColor(0xb659f5)
      .setTitle('🎵  Lecteur Musical')
      .setTimestamp()
      .setFooter({ text: `PixelHub • Queue: ${this.tracks.length} titre(s)` });
    if (!track) return e.setDescription('> Aucune musique en cours.');
    e.setDescription(`**[${track.title}](${track.url})**`)
      .addFields(
        { name: '⏱️ Durée', value: track.duration || '?:??', inline: true },
        { name: '👤 Demandé par', value: track.requestedBy, inline: true },
        { name: '🔁 Loop', value: this.loop ? '✅' : '❌', inline: true },
      );
    if (track.thumbnail) e.setThumbnail(track.thumbnail);
    if (this.tracks.length > 0) {
      const list = this.tracks.slice(0, 5).map((t, i) => `\`${i + 1}.\` ${t.title} — *${t.requestedBy}*`).join('\n');
      e.addFields({ name: `📋 File d'attente (${this.tracks.length})`, value: list });
    }
    return e;
  }

  buildButtons() {
    const paused = this.getStatus() === AudioPlayerStatus.Paused;
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_pause').setEmoji(paused ? '▶️' : '⏸️').setStyle(paused ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setStyle(this.loop ? ButtonStyle.Success : ButtonStyle.Secondary),
    );
  }

  async _updateEmbed() {
    if (!this.playerMessage) return;
    try {
      await this.playerMessage.edit({
        embeds: [this.buildEmbed()],
        components: this.current ? [this.buildButtons()] : [],
      });
    } catch (_) {}
  }
}

class MusicManager {
  constructor() { this.queues = new Map(); }
  get(guildId) {
    if (!this.queues.has(guildId)) this.queues.set(guildId, new MusicQueue(guildId));
    return this.queues.get(guildId);
  }
  delete(guildId) {
    try { this.queues.get(guildId)?.stop(); } catch (_) {}
    this.queues.delete(guildId);
  }
}

module.exports = new MusicManager();