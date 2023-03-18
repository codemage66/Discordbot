import { Events } from "discord.js";
import chalk from "chalk";
import ms from "ms";
import supabase from "../modules/supabase.js";
import { isPremium } from "../modules/premium.js";
import { checkTerms } from "../modules/terms.js";
import delay from "delay";

const interactionType = {
  type: "interaction",
  load: async (interaction, ephemeral = false) => {
    if (interaction && !interaction.deferred && !interaction.replied) {
      try {
        await interaction.deferReply();
      } catch (err) {}
    }
  },
  reply: async (interaction, content) => {
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(content);
    } else {
      return await interaction.reply(content);
    }
  },
};

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction, client) {
    if (
      !interaction.isChatInputCommand() &&
      !interaction.isContextMenuCommand()
    )
      return;
    var commands = await client.commands.toJSON();
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.error(
        `No command matching ${interaction.commandName} was found.`
      );
      return;
    }
    var guildId;
    if (interaction.guild) guildId = interaction.guild.id;
    await interactionType.load(interaction);

    var terms = await checkTerms(interaction.user.id, "discord");
    if (terms) {
      await interaction.editReply({
        content: terms,
        ephemeral: true,
      });
      await delay(8000);
    }
    var ispremium = await isPremium(interaction.user.id, guildId);

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
          // @ts-ignore
          var count = ms(command.cooldown) - diff;
          // @ts-ignore
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
            await interaction.editReply({
              content:
                `Use this command again **${ms(
                  count
                )}>**.\nIf you want to **avoid this cooldown** you can **donate to get premium**. If you want to donate use the command ` +
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
      console.log(error);
      try {
        await interactionType.reply(interaction, {
          content: "There was an error while executing this command!",
          ephemeral: true,
        });
      } catch (err) {}
    }
  },
};
