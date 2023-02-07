const discord = require("discord.js");
const { discordWebhook } = require("./config.json");

let log = new discord.WebhookClient({
  id: discordWebhook.id,
  token: discordWebhook.secret,
});

module.exports.webhook = (title, description) => {
  let embed = new discord.EmbedBuilder()
    .setColor(`#FF0000`)
    .setTitle(title)
    .setTimestamp()
    .setDescription(description);

  return log.send({ embeds: [embed] }).catch((e) => null);
};
