require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  Collection,
  EmbedBuilder,
} = require('discord.js');
const cron = require('node-cron');
const config = require('./config');
const { registerEvents } = require('./events/events');
const { sendStatusEmbed, sendStaffEmbed } = require('./utils/statusEmbed');
const { sendLog, logEmbed } = require('./utils/logger');

// ─── COMMANDS ─────────────────────────────────────────────────────────────────
const modCmds = require('./commands/moderation');
const musicCmds = require('./commands/music');
const utilityCmds = require('./commands/utility');

const allCommands = [
  // Modération
  modCmds.ban,
  modCmds.kick,
  modCmds.mute,
  modCmds.staff,
  modCmds.unban,
  modCmds.warn,
  // Musique
  musicCmds.play,
  musicCmds.join,
  musicCmds.stop,
  musicCmds.skip,
  musicCmds.queue,
  musicCmds.volume,
  // Utilitaires
  utilityCmds.clear,
  utilityCmds.slowmode,
  utilityCmds.lock,
  utilityCmds.unlock,
  utilityCmds.userinfo,
  utilityCmds.serverinfo,
  utilityCmds.avatar,
  utilityCmds.sondage,
  utilityCmds.roleinfo,
  utilityCmds.ping,
  utilityCmds.botinfo,
  utilityCmds.giveaway,
  utilityCmds.embed,
];

// ─── CLIENT ───────────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
});

// ─── COMMANDS MAP ─────────────────────────────────────────────────────────────
client.commands = new Collection();
for (const cmd of allCommands) {
  client.commands.set(cmd.data.name, cmd);
}

// ─── READY ────────────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  console.log(`📡 Serveurs: ${client.guilds.cache.size}`);

  client.user.setPresence({
    status: 'online',
    activities: [{ name: '3 serveurs | /help', type: 3 }],
  });

  // Déploiement des slash commands sur chaque serveur
  await deployCommands();

  // Embed état + staff au démarrage
  setTimeout(async () => {
    await sendStatusEmbed(client);
    await sendStaffEmbed(client);
    console.log('[STATUS] Embeds de démarrage envoyés.');
  }, 3000);

  // Mise à jour des embeds état toutes les 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    await sendStatusEmbed(client);
  });

  // Log global de démarrage
  const startEmbed = new EmbedBuilder()
    .setTitle('🚀 Bot Démarré')
    .setDescription('Le bot est maintenant en ligne et opérationnel sur tous les serveurs.')
    .setColor(config.colors.success)
    .addFields(
      { name: '🌐 Serveurs', value: `${client.guilds.cache.size}`, inline: true },
      { name: '📦 Version', value: `v${config.version}`, inline: true },
      { name: '🕐 Démarrage', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
    )
    .setTimestamp();

  await sendLog(client, startEmbed);
});

// ─── INTERACTIONS ─────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);

    // Log de la commande
    const logEmb = logEmbed(
      'Commande Exécutée',
      `**/${interaction.commandName}** utilisée par **${interaction.user.tag}** dans <#${interaction.channelId}>`,
      config.colors.info
    );
    await sendLog(client, logEmb, interaction.guildId);
  } catch (err) {
    console.error(`[CMD ERROR] /${interaction.commandName}: ${err.message}`);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Erreur')
      .setDescription(`Une erreur est survenue lors de l'exécution de la commande.\n\`${err.message}\``)
      .setColor(config.colors.error)
      .setTimestamp();

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    } catch (_) {}
  }
});

// ─── DEPLOY COMMANDS ──────────────────────────────────────────────────────────
async function deployCommands() {
  const rest = new REST({ version: '10' }).setToken(config.token);
  const body = allCommands.map(c => c.data.toJSON());

  for (const guildConf of config.guilds) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guildConf.id),
        { body }
      );
      console.log(`✅ Commandes déployées sur ${guildConf.name} (${guildConf.id})`);
    } catch (err) {
      console.error(`❌ Erreur déploiement ${guildConf.name}: ${err.message}`);
    }
  }
}

// ─── EVENTS ───────────────────────────────────────────────────────────────────
registerEvents(client);

// ─── ERROR HANDLING ───────────────────────────────────────────────────────────
process.on('unhandledRejection', err => console.error('[UNHANDLED]', err));
process.on('uncaughtException', err => console.error('[UNCAUGHT]', err));

// ─── LOGIN ────────────────────────────────────────────────────────────────────
if (!config.token || config.token === 'TON_TOKEN_ICI') {
  console.error('❌ ERREUR: Aucun token Discord trouvé dans le fichier .env !');
  console.error('→ Modifie le fichier .env et remplace TON_TOKEN_ICI par ton token.');
  process.exit(1);
}

client.login(config.token).catch(err => {
  console.error('❌ Erreur de connexion:', err.message);
  process.exit(1);
});
