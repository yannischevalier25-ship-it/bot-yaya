require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN,

  guilds: [
    {
      id: '1413898439330238608',
      logChannel: '1414249403925135403',
      statusChannel: '1463279970670350346',
      name: 'Serveur 1',
    },
    {
      id: '1422975574669791314',
      logChannel: '1463721434592444458',
      statusChannel: '1463350384478261389',
      name: 'Serveur 2',
    },
    {
      id: '1375951151509278770',
      logChannel: '1394823966828531753',
      statusChannel: '1463350314085253398',
      name: 'Serveur 3',
    },
  ],

  staffChannel: '1470892345502204077',

  colors: {
    primary: 0x5865F2,
    success: 0x57F287,
    error: 0xED4245,
    warning: 0xFEE75C,
    info: 0x00B0F4,
    music: 0xFF73FA,
    log: 0x2F3136,
    ban: 0xFF0000,
    mute: 0xFF8C00,
    kick: 0xFFA500,
  },

  startTime: Date.now(),
  version: '1.0.0',
  lastUpdate: '2025-07-15',
};