const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
    // Your existing /setup command
    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configure the bot for this server.')
        .setDefaultMemberPermissions(0)
        .setDMPermission(false) // Explicitly disable for DMs
        .addSubcommand(subcommand =>
            subcommand
                .setName('channel')
                .setDescription('Set the channel where the bot will respond.')
                .addChannelOption(option => option.setName('target').setDescription('The channel to use').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('role')
                .setDescription('Set the role required to use the bot.')
                .addRoleOption(option => option.setName('target').setDescription('The role to require').setRequired(true))
        ),
    // Command 1: /chat
    new SlashCommandBuilder()
        .setName('chat')
        .setDescription('Start a conversation with Novus (standard model but the fastest). | Works on DM"s!')
        .setDMPermission(true)
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('Your question or message.')
                .setRequired(true)
        ),
    // Command 2: /chat2
    new SlashCommandBuilder()
        .setName('chat2')
        .setDescription('Chat with Novus (alternative, more direct model but less fast).')
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('Your question or message.')
                .setRequired(true)
        ),
    // Command 3: /think
    new SlashCommandBuilder()
        .setName('think')
        .setDescription('Ask Novus a complex question (uses a reasoning model and takes more time).')
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('Your complex question or message.')
                .setRequired(true)
        ),
    // Command 4: /think
    new SlashCommandBuilder()
        .setName('think2')
        .setDescription('Ask Novus a complex question (uses a reasoning model and takes more time). Newest model.')
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('Your complex question or message.')
                .setRequired(true)
        ),
    // Command 5: /image
    new SlashCommandBuilder()
        .setName('image')
        .setDescription('Ask Novus a question about an image.')
        .setDMPermission(false)
        .addAttachmentOption(option =>
            option.setName('image')
                .setDescription('The image to analyze.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('Your question about the image.')
                .setRequired(true)
        ),
    // Command 6: /remember
    new SlashCommandBuilder()
        .setName('remember')
        .setDescription('Saves a piece of information for Novus to remember about you.')
        .setDMPermission(true)
        .addStringOption(option =>
            option.setName('data')
                .setDescription('The information you want me to remember (e.g., "My favorite color is blue").')
                .setRequired(true)
        ),

    // Command 7: /forget
    new SlashCommandBuilder()
        .setName('forget')
        .setDescription('Makes Novus forget all stored information about you.')
        .setDMPermission(true),
    // Command 8: /summarize
    new SlashCommandBuilder()
        .setName('summarize')
        .setDescription('Summarizes the recent conversation in this channel.')
        .setDMPermission(false)
        .addIntegerOption(option =>
            option.setName('count')
                .setDescription('Number of messages to summarize (default: 100, max: 100).')
                .setRequired(false)
        ),
    // Command 9: /stats
    new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Displays usage statistics for the bot.')
        .setDefaultMemberPermissions(0) // Admin-only
        .setDMPermission(false), // Server-only
    // Command 10: /websearch
    new SlashCommandBuilder()
        .setName('websearch')
        .setDescription('Asks Novus a question with access to live web search results.')
        .setDMPermission(false) // This to prevent users from searching malicious data without admin concerns.
        .addStringOption(option =>
            option.setName('query')
                .setDescription('The question you want to search the web for.')
                .setRequired(true)
        ),
    // Command 11: /analyze
    new SlashCommandBuilder()
        .setName('analyze')
        .setDescription('Analyzes a .txt or .pdf file and answers your question about it.')
        .setDMPermission(false) // Prevent users from analyzing weird or malicious documents.
        .addAttachmentOption(option =>
            option.setName('document')
                .setDescription('The .txt or .pdf file you want to analyze.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('Your question about the document.')
                .setRequired(true)
        ),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();