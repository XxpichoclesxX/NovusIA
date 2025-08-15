# Novus - A Multi-Model Ollama Discord Bot
Novus is a powerful, self-hosted Discord bot that integrates directly with Ollama, allowing you to bring the power of various open-source large language models to your Discord server. It's designed to be professional, configurable, and versatile, offering different models for different tasks, from standard chatting and complex reasoning to image analysis.

## ✨ Features
- **Multi-Model Support**: Use different commands (/chat, /chat2, /think) to interact with specific language models tailored for different tasks.
- **Image Analysis**: Ask questions about images directly in Discord using the /image command and a vision-capable model.
- **Slash Commands**: Modern, intuitive, and permission-friendly interaction using Discord's built-in slash commands.
- **Server-Specific Configuration**: Administrators can easily configure the bot to operate only in a specific channel and require a specific role for access using the /setup command.
- **Conversation History**: The bot remembers the context of recent messages in a channel for more natural, flowing conversations.
- **Self-Hosted & Private**: Because it runs on your own machine based on Ollama, your conversations remain private and under your control.

## 📋 Prerequisites
Before you begin, ensure you have the following installed on your system:
- **[Node.js](https://nodejs.org/)** (v18.x or higher recommended)
- **[npm](https://www.npmjs.com/)** (comes bundled with Node.js)
- **[Ollama](https://ollama.com/)** installed and running on your machine.

## 🚀 Installation
Follow these steps to get your Novus bot up and running. 

### 1. Clone the Repository
First, clone this repository to your local machine.
```bash
git clone [https://github.com/XxpichoclesxX/NovusIA.git](https://github.com/XxpichoclesxX/NovusIA.git)
cd NovusIA
```

### 2. Install Dependencies
```bash
npm install
```
Note: *If it doesn't work, do it manually:*
```bash
npm install discord.js
npm install dotenv
npm install axios
```

### 3. Set Up the Discord Bot
1. **Create an Application**: Go to the [Discord Developer Portal](https://discord.com/developers/applications), click New Application, and give it a name (e.g., "NovusIA").
2. **Create a Bot User**: In your application's settings, go to the Bot tab and click Add Bot.
3. **Get Bot Token**: Under the bot's username, click Reset Token to reveal and copy your bot's token. Treat this like a password!
4. **Get Client ID**: Go to the OAuth2 --> General tab and copy your Client ID.
5. **Enable Intents**: On the Bot tab, scroll down and enable the Message Content Intent.

### 4. Configure Environment Variables
First rename the file named **example.env** to just **.env** without a name. *This will make the file hidden for the commands only.*
```
# .env file
DISCORD_TOKEN=YOUR_DISCORD_BOT_TOKEN_HERE
CLIENT_ID=YOUR_APPLICATION_CLIENT_ID_HERE
```

### 5. Download Ollama Models
Novus is configured to use several different models. Open your terminal and pull them from Ollama. (I recommend ubuntu or a linux system, if on windows, enable linux as a subsystem)
```bash
ollama pull llama3.2:latest
ollama pull llama3.1:latest (Or the model you want)
ollama pull deepseek-r1:8b (Or the model you want)
ollama pull gemma3:4b (Or the model you want)
```
Note: *You can change these model names in index.js if you prefer to use different ones.*

## ⚙️ Usage
### 1. Deploy Slash Commands
Before starting the bot for the first time, you must register its commands with Discord. Run the deployment script:
```bash
node deploy-commands.js
```
Note: *You only need to run this script once, or whenever you change the commands.*

### 2. Start the Bot
Launch the bot using Node.js. Make sure your Ollama server is running in the background.
```bash
node index.js
```
*If successful, your console will log Ready! Logged in as YourBotName#1234.*

### 3. Invite the Bot to Your Server
1. In the Discord Developer Portal, go to Installation, mark only "*guild install*" -> Discord Provided Link.
2. Select the bot permissions (i recommend admin).
3. Copy the generated URL, paste it into your browser, and invite the bot to your server.

### 4. Configure Novus on Your Server
Once the bot joins, it will send a welcome message. An administrator must perform the initial setup:
- **/setup channel #your-channel**: Sets the only channel where Novus will respond.
- **/setup role @your-role**: Sets the role that users must have to interact with Novus.

## 💬 Commands
<div align="center">

| **Command** | **Description** | Default Model Used | Download | **Size Recommendation** |
| :---: | :---: | :---: | :---: | :---: |
| **/setup** | (Admin Only) Configures the required channel and role. | No Model | No Model | No Model |
| **/chat** | Starts a standard conversation with Novus. | llama3.2 | [Llama3.2](https://ollama.com/library/llama3.2) | Super small even being the biggest; `llama3.2:3b` or `llama3.2:latest` |
| **/chat2** | Starts a conversation with an alternative model. | llama3.1 | [Llama3.1](https://ollama.com/library/llama3.1) | Depends on your machine; `llama3.1:8b` or `llama3.1:latest` |
| **/think** | Asks a complex question using a reasoning model. | deepseek-r1 | [Deepseek-r1](https://ollama.com/library/deepseek-r1) | Big and needs a good end machine; `deepseek-r1:8b` or `deepseek-r1:latest` |
| **/think2** | Asks a complex question using a reasoning model. | qwen3:8b | [Qwen-3](https://ollama.com/library/qwen3) | Big and needs a good end machine; `qwen3:8b` or `qwen3:latest` |
| **/image** | Asks a question about an attached image. | gemma3 | [Gemma3](https://ollama.com/library/gemma3) | Needs minimum `gemma3:4b` for vision or higher. |
| **/remember** |A way the bot can remember your data. | N/A | [N/A](https://github.com/XxpichoclesxX/NovusIA) | N/A. |
| **/forget** | The way the bot to forget all your data. | N/A | [N/A](https://github.com/XxpichoclesxX/NovusIA) | N/A. |
| **/summarize** | A way to summarize the guild chat that you are currently on. | N/A |[N/A](https://github.com/XxpichoclesxX/NovusIA) | N/A. |
| **/stats** | A way to ask for the stats for the use of the bot. | N/A | [N/A](https://github.com/XxpichoclesxX/NovusIA) | N/A. |

</div>

## 📄 License
This project is licensed under the Ryze License. See the LICENSE file for details.
