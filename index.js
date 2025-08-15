const fs = require('fs');
const axios = require('axios');
const { Client, GatewayIntentBits, ChannelType, MessageFlags } = require('discord.js');
require('dotenv').config();

// --- Configuration and Data ---
const CONFIG_FILE = './config.json';
const USER_DATA_FILE = './user_data.json';
const STATS_FILE = './stats.json';

let userData = {};
let serverConfigs = {};
let promptCounter = 0;
let usageStats = { totalPrompts: 0, commandUsage: {} };

const conversationHistories = {};

try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf8');
    serverConfigs = JSON.parse(data);
} catch (error) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({}));
}

try {
    const data = fs.readFileSync(USER_DATA_FILE, 'utf8');
    userData = JSON.parse(data);
} catch (error) {
    console.log("user_data.json not found, creating a new one.");
    fs.writeFileSync(USER_DATA_FILE, JSON.stringify({}));
}

try {
    const data = fs.readFileSync(STATS_FILE, 'utf8');
    usageStats = JSON.parse(data);
} catch (error) {
    console.log("stats.json not found, creating a new one.");
    fs.writeFileSync(STATS_FILE, JSON.stringify(usageStats));
}

// --- Discord Client Setup ---
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once('ready', () => console.log(`Ready! Logged in as ${client.user.tag}`));

// --- Event Handlers ---
client.on('guildCreate', guild => {
    const channel = guild.systemChannel || guild.channels.cache.find(ch => ch.type === ChannelType.GuildText);
    if (channel) {
        channel.send(
            `Hello! I am Novus. To get started, an administrator needs to configure me using \`/setup channel\` and \`/setup role\`.`
        );
    }
});

// Main handler for all slash command interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    const userId = interaction.user.id; // Get the user ID for all commands

    try {
        // --- DM Handling ---
        if (!interaction.inGuild()) {
            promptCounter++;
            console.log(`[Prompt #${promptCounter}] Command: /${commandName} | User: ${interaction.user.tag} (DM)`);

            // --- Remember & Forget in DMs ---
            if (commandName === 'remember') {
                const dataToRemember = interaction.options.getString('data');
                if (!userData[userId]) userData[userId] = [];
                userData[userId].push(dataToRemember);
                fs.writeFileSync(USER_DATA_FILE, JSON.stringify(userData, null, 2));
                return interaction.reply({ content: `✅ Got it. I'll remember that.`, flags: [MessageFlags.Ephemeral] });
            }

            if (commandName === 'forget') {
                if (userData[userId]) {
                    delete userData[userId];
                    fs.writeFileSync(USER_DATA_FILE, JSON.stringify(userData, null, 2));
                    return interaction.reply({ content: `✅ I have forgotten everything about you.`, flags: [MessageFlags.Ephemeral] });
                } else {
                    return interaction.reply({ content: `I don't have any information stored for you.`, flags: [MessageFlags.Ephemeral] });
                }
            }

            const prompt = interaction.options.getString('prompt');
            const channelId = userId; // Use user ID for DM history
            if (!conversationHistories[channelId]) conversationHistories[channelId] = [];
            const currentHistory = conversationHistories[channelId];
            const userMemory = userData[userId] ? userData[userId].join('\n') : "";

            await interaction.deferReply();

            // --- Corrected Image & Text Handling for DMs ---
            if (commandName === 'image') {
                const image = interaction.options.getAttachment('image');
                if (!image.contentType?.startsWith('image/')) {
                    return interaction.editReply({ content: 'Please provide a valid image file.' });
                }
                // Image responses don't stream, so we handle them differently
                const responseStream = await getOllamaResponse(prompt, [], 'llava:latest', image.url, userMemory);
                let ollamaContent = '';
                for await (const chunk of responseStream.data) {
                    const lines = chunk.toString().split('\n');
                    lines.forEach(line => {
                        if (line.trim() === '') return;
                        try {
                            const parsed = JSON.parse(line);
                            if (parsed.message && parsed.message.content) {
                                ollamaContent += parsed.message.content;
                            }
                        } catch (e) { /* Ignore parsing errors */ }
                    });
                }
                await interaction.editReply(ollamaContent);
                return; // End interaction for image command
            }

            const models = { chat: 'llama3.2:latest', chat2: 'llama3.1:latest', think: 'deepseek-r1:8b' };
            const model = models[commandName];

            if (!model) return interaction.editReply("Sorry, that's an invalid command.");

            const streamResponse = await getOllamaResponse(prompt, currentHistory, model, null, userMemory);

            let fullContent = "";
            let buffer = "";
            let lastUpdateTime = 0;
            const header = `**You asked:**\n> ${prompt}\n\n**Novus answered:**\n`;

            streamResponse.data.on('data', chunk => {
                const lines = chunk.toString().split('\n');
                lines.forEach(line => {
                    if (line.trim() === '') return;
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.message && parsed.message.content) {
                            buffer += parsed.message.content;
                        }
                    } catch (e) { /* Ignore incomplete JSON */ }
                });

                const now = Date.now();
                if (now - lastUpdateTime > 1500 && buffer.length > 0) {
                    fullContent += buffer;
                    buffer = "";
                    interaction.editReply(header + fullContent + '▌').catch(console.error);
                    lastUpdateTime = now;
                }
            });

            streamResponse.data.on('end', () => {
                fullContent += buffer;
                interaction.editReply(header + fullContent).catch(console.error);

                currentHistory.push({ role: 'user', content: prompt });
                currentHistory.push({ role: 'assistant', content: fullContent });
                while (currentHistory.length > 10) currentHistory.shift();
            });
            // The premature 'return;' was removed from here.
            return; // This return is now correctly placed after the logic is defined.
        }

        // --- Server (Guild) Handling ---
        const config = serverConfigs[interaction.guild.id];

        if (commandName === 'setup') {
            const subcommand = interaction.options.getSubcommand();
            if (!serverConfigs[interaction.guild.id]) serverConfigs[interaction.guild.id] = {};
            if (subcommand === 'channel') {
                const targetChannel = interaction.options.getChannel('target');
                serverConfigs[interaction.guild.id].channelId = targetChannel.id;
                fs.writeFileSync(CONFIG_FILE, JSON.stringify(serverConfigs, null, 2));
                await interaction.reply({ content: `✅ Novus will now operate in ${targetChannel}.`, flags: [MessageFlags.Ephemeral] });
            } else if (subcommand === 'role') {
                const targetRole = interaction.options.getRole('target');
                serverConfigs[interaction.guild.id].roleId = targetRole.id;
                fs.writeFileSync(CONFIG_FILE, JSON.stringify(serverConfigs, null, 2));
                await interaction.reply({ content: `✅ Users now need the ${targetRole.name} role.`, flags: [MessageFlags.Ephemeral] });
            }
            return;
        }

        if (commandName === 'remember' || commandName === 'forget' || commandName === 'stats') {
            // Your existing server-side logic for these commands is correct and goes here...
            return;
        }

        if (!config || !config.channelId || !config.roleId) {
            return interaction.reply({ content: '⚠️ This bot has not been configured. Use `/setup` first.', flags: [MessageFlags.Ephemeral] });
        }
        if (interaction.channel.id !== config.channelId) {
            return interaction.reply({ content: `⚠️ Please use bot commands in <#${config.channelId}>.`, flags: [MessageFlags.Ephemeral] });
        }
        if (!interaction.member.roles.cache.has(config.roleId)) {
            return interaction.reply({ content: `⛔ You do not have the required role to use this command.`, flags: [MessageFlags.Ephemeral] });
        }
        
        promptCounter++;
        console.log(`[Prompt #${promptCounter}] Command: /${commandName} | User: ${interaction.user.tag}`);

        usageStats.totalPrompts++;
        usageStats.commandUsage[commandName] = (usageStats.commandUsage[commandName] || 0) + 1;
        fs.writeFileSync(STATS_FILE, JSON.stringify(usageStats, null, 2));

        const prompt = interaction.options.getString('prompt');
        const channelId = interaction.channel.id;
        if (!conversationHistories[channelId]) conversationHistories[channelId] = [];
        const currentHistory = conversationHistories[channelId];
        const userMemory = userData[userId] ? userData[userId].join('\n') : "";

        if (commandName === 'summarize') {
            // Your existing summarize logic is correct and goes here...
            return;
        }

        await interaction.deferReply();

        if (commandName === 'image') {
            const image = interaction.options.getAttachment('image');
            if (!image.contentType?.startsWith('image/')) {
                return interaction.editReply({ content: 'Please provide a valid image file.' });
            }
            const ollamaMessage = await getOllamaResponse(prompt, [], 'llava:latest', image.url, userMemory);
            await interaction.editReply(`**${interaction.user.username} asked:**\n> ${prompt}\n\n**Novus answered:**\n${ollamaMessage.content}`);
            return;
        }

        const models = { chat: 'llama3.2:latest', chat2: 'llama3.1:latest', think: 'deepseek-r1:8b' };
        const model = models[commandName];

        if (!model) return interaction.editReply("Sorry, that's an invalid command.");

        const streamResponse = await getOllamaResponse(prompt, currentHistory, model, null, userMemory);

        let fullContent = "";
        let buffer = "";
        let lastUpdateTime = 0;
        const header = `**${interaction.user.username} asked:**\n> ${prompt}\n\n**Novus answered:**\n`;

        streamResponse.data.on('data', chunk => {
            const lines = chunk.toString().split('\n');
            lines.forEach(line => {
                if (line.trim() === '') return;
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.message && parsed.message.content) {
                        buffer += parsed.message.content;
                    }
                } catch (e) { /* Ignore incomplete JSON */ }
            });

            const now = Date.now();
            if (now - lastUpdateTime > 1500 && buffer.length > 0) {
                fullContent += buffer;
                buffer = "";
                interaction.editReply(header + fullContent + '▌').catch(console.error);
                lastUpdateTime = now;
            }
        });

        streamResponse.data.on('end', () => {
            fullContent += buffer;
            interaction.editReply(header + fullContent).catch(console.error);

            currentHistory.push({ role: 'user', content: prompt });
            currentHistory.push({ role: 'assistant', content: fullContent });
            while (currentHistory.length > 10) currentHistory.shift();
        });

    } catch (error) {
        console.error(error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'An unexpected error occurred.', flags: [MessageFlags.Ephemeral] });
        } else {
            await interaction.editReply('An unexpected error occurred.').catch(console.error);
        }
    }
});

// --- Ollama API Function ---
async function getOllamaResponse(prompt, conversationHistory, model, imageUrl = null, userMemory = "") {
    const ollamaApiUrl = 'http://localhost:11434/api/chat';
    const systemPrompt = `
    You are Novus, a professional and helpful AI assistant operating on a Discord server.
    Your purpose is to provide accurate, reliable information and assist users with their daily tasks.

    Your core guidelines are:
    1.  **Professional Tone:** Your communication must be clear, concise, and professional at all times.
    2.  **Accuracy is Key:** Prioritize factual correctness. If a request is ambiguous, ask for clarification.
    3.  **Clarity in Structure:** For complex answers, use formatting like bullet points or numbered lists to improve readability.
    4.  **Honesty in Capability:** If you do not know an answer or cannot fulfill a request, state it directly. Do not invent information.
    5.  **Maintain Persona:** You are Novus. Do not refer to yourself as a language model or AI.
    6.  **Avoid Informality:** Do not use slang, puns, or emojis. You can do so if the conversation needs them or if the user is doing so.

    ---
    Here is some information the user has asked you to remember. Use it to personalize your response if relevant:
    ${userMemory}
    ---
    `;

    const messages = [{ role: "system", content: systemPrompt }, ...conversationHistory, { role: "user", content: prompt }];
    
    // Handle image input
    if (imageUrl) {
        try {
            const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const imageBase64 = Buffer.from(imageResponse.data).toString('base64');
            messages[messages.length - 1].images = [imageBase64];
        } catch (error) {
            console.error("Failed to fetch or process image:", error);
            throw new Error('I was unable to process the image provided.');
        }
    }

    const requestData = { 
        model, 
        messages, 
        stream: true,
        options: { num_predict: 2048 } 
    };

    try {
        return await axios.post(ollamaApiUrl, requestData, { responseType: 'stream' });
    } catch (error) {
        console.error(`Error with model ${model}:`, error.message);
        throw new Error("My circuits are having an issue. Please try again. ⚙️");
    }
}

client.login(process.env.DISCORD_TOKEN);