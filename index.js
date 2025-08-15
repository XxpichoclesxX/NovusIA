const fs = require('fs');
const axios = require('axios');
const pdf = require('pdf-parse');
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

client.on('guildDelete', guild => {
    if (serverConfigs[guild.id]) {
        delete serverConfigs[guild.id];
        
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(serverConfigs, null, 2));
        
        console.log(`Removed configuration for server: ${guild.name} (ID: ${guild.id})`);
    }
});

// Main handler for all slash command interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    const userId = interaction.user.id;

    try {
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

        // --- Server-only commands and permission checks ---
        if (interaction.inGuild()) {
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

            if (commandName === 'stats') {
                let description = `**Total Prompts Handled:** ${usageStats.totalPrompts}\n\n**Command Breakdown:**\n`;
                for (const [command, count] of Object.entries(usageStats.commandUsage)) {
                    description += ` • **/${command}**: ${count} times\n`;
                }
                const statsEmbed = {
                    color: 0x0099ff,
                    title: 'Novus Usage Statistics',
                    description: description,
                    timestamp: new Date().toISOString(),
                };
                return interaction.reply({ embeds: [statsEmbed], flags: [MessageFlags.Ephemeral] });
            }

            // For all other commands, check permissions
            if (!config || !config.channelId || !config.roleId) {
                return interaction.reply({ content: '⚠️ This bot has not been configured. Use `/setup` first.', flags: [MessageFlags.Ephemeral] });
            }
            if (interaction.channel.id !== config.channelId) {
                return interaction.reply({ content: `⚠️ Please use bot commands in <#${config.channelId}>.`, flags: [MessageFlags.Ephemeral] });
            }
            if (!interaction.member.roles.cache.has(config.roleId)) {
                return interaction.reply({ content: `⛔ You do not have the required role to use this command.`, flags: [MessageFlags.Ephemeral] });
            }
        }

        // --- Main Command Logic (for both DMs and Servers) ---
        promptCounter++;
        const logContext = interaction.inGuild() ? "" : " (DM)";
        console.log(`[Prompt #${promptCounter}] Command: /${commandName} | User: ${interaction.user.tag}${logContext}`);

        usageStats.totalPrompts++;
        usageStats.commandUsage[commandName] = (usageStats.commandUsage[commandName] || 0) + 1;
        fs.writeFileSync(STATS_FILE, JSON.stringify(usageStats, null, 2));

        const prompt = interaction.options.getString('prompt') || interaction.options.getString('query');
        const channelId = interaction.inGuild() ? interaction.channel.id : userId;
        if (!conversationHistories[channelId]) conversationHistories[channelId] = [];
        const currentHistory = conversationHistories[channelId];
        const userMemory = userData[userId] ? userData[userId].join('\n') : "";

        if (commandName === 'summarize') {
            if (!interaction.inGuild()) return interaction.reply({ content: "Sorry, the `/summarize` command only works in servers.", flags: [MessageFlags.Ephemeral] });
            
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const count = interaction.options.getInteger('count') || 100;
            if (count > 100) return interaction.editReply("Sorry, I can only summarize a maximum of 100 messages at a time.");

            const messages = await interaction.channel.messages.fetch({ limit: count });
            const transcript = messages.reverse().map(msg => `${msg.author.username}: ${msg.content}`).join('\n');

            if (transcript.length < 50) return interaction.editReply("There isn't enough conversation to summarize.");

            const summaryPrompt = `Please provide a concise, bullet-point summary of the key topics and decisions in the following conversation transcript:\n\n---\n${transcript}\n---`;
            const responseStream = await getOllamaResponse(summaryPrompt, [], 'llama3.1:latest');
            
            let ollamaContent = '';
            for await (const chunk of responseStream.data) {
                const lines = chunk.toString().split('\n');
                lines.forEach(line => {
                    if (line.trim() === '') return;
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.message && parsed.message.content) ollamaContent += parsed.message.content;
                    } catch (e) {}
                });
            }
            await interaction.editReply(`**Summary of the last ${messages.size} messages:**\n${ollamaContent}`);
            return;
        }

        await interaction.deferReply();

        // --- Unified Streaming Logic ---
        const models = { chat: 'llama3.2:latest', chat2: 'llama3.1:latest', think: 'deepseek-r1:8b', think2: 'qwen3:8b', websearch: 'llama3.1:latest' };
        let model = commandName === 'image' ? 'gemma3:4b' : models[commandName];
        let finalPrompt = prompt;

        if (commandName === 'analyze') {
            const attachment = interaction.options.getAttachment('document');
            let documentText = '';

            if (attachment.contentType === 'application/pdf') {
                const response = await axios.get(attachment.url, { responseType: 'arraybuffer' });
                const data = await pdf(response.data);
                documentText = data.text;
            } else if (attachment.contentType.startsWith('text/')) {
                const response = await axios.get(attachment.url);
                documentText = response.data;
            } else {
                return interaction.editReply({ content: "Sorry, I can only analyze `.txt` and `.pdf` files." });
            }

            if (!documentText) {
                return interaction.editReply({ content: "I couldn't read any text from that document." });
            }
            
            const truncatedText = documentText.slice(0, 3000); 
            finalPrompt = `Based on the content of the provided document, please answer the user's question.\n\nDocument Content:\n---\n${truncatedText}\n---\n\nUser's Question: "${prompt}"`;
            model = 'llama3.1:latest';
        } else if (commandName === 'websearch') {
            const searchContext = await searchWeb(prompt);
            finalPrompt = `Based on these web results, answer the user's query.\n\nResults:\n---\n${searchContext}\n---\n\nQuery: "${prompt}"`;
        }

        if (!model) return interaction.editReply("Sorry, that's an invalid command.");

        const imageUrl = commandName === 'image' ? interaction.options.getAttachment('image')?.url : null;
        if (commandName === 'image' && !interaction.options.getAttachment('image')?.contentType?.startsWith('image/')) {
            return interaction.editReply({ content: 'Please provide a valid image file.' });
        }
        
        const streamResponse = await getOllamaResponse(finalPrompt, currentHistory, model, imageUrl, userMemory);

        let fullContent = "";
        let buffer = "";
        let lastUpdateTime = 0;
        let isTooLong = false;
        const header = interaction.inGuild() 
            ? `**${interaction.user.username} asked:**\n> ${prompt}\n\n**Novus answered:**\n`
            : `**You asked:**\n> ${prompt}\n\n**Novus answered:**\n`;

        for await (const chunk of streamResponse.data) {
            const lines = chunk.toString().split('\n');
            lines.forEach(line => {
                if (line.trim() === '') return;
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.message && parsed.message.content) buffer += parsed.message.content;
                } catch (e) { /* Ignore incomplete JSON */ }
            });

            const now = Date.now();
            if (!isTooLong && now - lastUpdateTime > 1500 && buffer.length > 0) {
                if ((header + fullContent + buffer).length > 1800) {
                    isTooLong = true;
                    // Send the "preparing file" message and stop trying to stream text updates
                    await interaction.editReply(header + fullContent + buffer + "\n\n⚠️ My answer is too long! I am preparing a .txt file, please wait...").catch(console.error);
                } else {
                    fullContent += buffer;
                    buffer = "";
                    await interaction.editReply(header + fullContent + '▌').catch(console.error);
                    lastUpdateTime = now;
                }
            }
        }

        fullContent += buffer; // Add any remaining text from the buffer

        if (isTooLong) {
            const responseFile = Buffer.from(fullContent, 'utf-8');
            await interaction.editReply({
                content: `**${interaction.user.username} asked:**\n> ${prompt}\n\n**Novus answered:**\nThe response was too long to display. See the attached file.`,
                files: [{ attachment: responseFile, name: 'response.txt' }]
            });
        } else {
            await interaction.editReply(header + fullContent).catch(console.error);
        }

        if (['chat', 'chat2', 'think', 'think2'].includes(commandName)) {
            currentHistory.push({ role: 'user', content: prompt });
            currentHistory.push({ role: 'assistant', content: fullContent });
            while (currentHistory.length > 10) currentHistory.shift();
        }

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

// --- Serper Web Search API Function ---
async function searchWeb(query) {
    try {
        const response = await axios.post('https://google.serper.dev/search', {
            q: query
        }, {
            headers: {
                'X-API-KEY': process.env.SERPER_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        
        // Extract snippets from the search results to create a context
        return response.data.organic.map(result => result.snippet).slice(0, 5).join('\n');
    } catch (error) {
        console.error("Error fetching web search results:", error.message);
        return "Failed to retrieve web search results.";
    }
}

client.login(process.env.DISCORD_TOKEN);