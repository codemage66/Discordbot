import { Events } from "discord.js";
import chalk from "chalk";
import ms from "ms";
import supabase from "../modules/supabase.js";
import { isPremium } from "../modules/premium.js";

const interactionType = {
  type: "interaction",
  load: async (interaction) => {
    await interaction.deferReply();
  },
  reply: async (interaction, content) => {
    console.log(interaction);
    if (interaction.deferred || interaction.replied) {
      interaction.reply(content);
    } else {
      interaction.editReply(content);
    }
  },
};

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;
    var commands = await client.commands.toJSON();
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.error(
        `No command matching ${interaction.commandName} was found.`
      );
      return;
    }

    var ispremium = await isPremium(interaction.user.id);
    try {
      if (command.cooldown && ispremium == false) {
        let { data: cooldowns, error } = await supabase
          .from("cooldown")
          .select("*")

          // Filters
          .eq("userId", interaction.user.id)
          .eq("command", interaction.commandName);
        if (cooldowns && cooldowns[0]) {
          var cooldown = cooldowns[0];
          var createdAt = new Date(cooldown.created_at);
          var milliseconds = createdAt.getTime();
          var now = Date.now();
          var diff = now - milliseconds;
          var count = ms(command.cooldown) - diff;
          if (diff >= ms(command.cooldown)) {
            const { data, error } = await supabase
              .from("cooldown")
              .update({ created_at: new Date() })
              .eq("userId", interaction.user.id)
              .eq("command", interaction.commandName);
            await command.execute(
              interaction,
              client,
              commands,
              interactionType
            );
          } else {
            await interaction.reply({
              content:
                `Please wait **${ms(
                  count
                )}** to use this command again.\nIf you want to **avoid this cooldown** you can **donate to get premium**. If you want to donate use the command ` +
                "`/premium buy` .",
              ephemeral: true,
            });
          }
        } else {
          const { data, error } = await supabase
            .from("cooldown")
            .insert([
              { userId: interaction.user.id, command: interaction.commandName },
            ]);
          await command.execute(interaction, client, commands, interactionType);
        }
      } else {
        await command.execute(interaction, client, commands, interactionType);
      }
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  },
};
