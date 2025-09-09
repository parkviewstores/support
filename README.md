# Discord DM Ticket System Bot

A professional Discord bot that creates ticket channels from direct messages, perfect for support systems.

## Features

- ✅ **DM to Ticket**: Automatically creates ticket channels when users DM the bot
- 🔒 **Private Channels**: Only staff can see and respond to tickets
- 💬 **Message Mirroring**: Seamless communication between users and staff
- 🎫 **Ticket Management**: Close tickets with slash commands
- 📊 **Production Ready**: Error handling, logging, and graceful shutdown

## Setup Instructions

### 1. Bot Creation
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application and bot
3. Copy the bot token
4. Enable these bot permissions:
   - Send Messages
   - Read Message History
   - Use Slash Commands
   - Manage Channels
   - Add Reactions

### 2. Server Setup
1. Create a category for tickets (e.g., "🎫 Support Tickets")
2. Create a staff role (e.g., "Support Staff")
3. Get the IDs for your server, category, and staff role

### 3. Configuration
1. Copy `.env.example` to `.env`
2. Fill in your configuration:
```env
TOKEN=your_bot_token_here
GUILD_ID=your_server_id_here
CATEGORY_ID=your_ticket_category_id_here
STAFF_ROLE_ID=your_staff_role_id_here
```

### 4. Installation & Running
```bash
npm install
npm start
```

## How It Works

### For Users
1. DM the bot with your question/issue
2. Bot creates a private ticket channel
3. Receive responses from staff in your DMs
4. Get notified when ticket is closed

### For Staff
1. View new tickets in the designated category
2. Respond normally in ticket channels
3. Messages are automatically sent to user DMs
4. Use `/close` command to close tickets

## Commands

- `/close` - Close the current ticket (staff only)

## Getting IDs

To get Discord IDs, enable Developer Mode in Discord settings, then:
- **Server ID**: Right-click server → Copy Server ID
- **Category ID**: Right-click category → Copy Channel ID  
- **Role ID**: Right-click role → Copy Role ID

## Deployment

### Replit
1. Import this project to Replit
2. Add environment variables in Replit's secrets
3. Run the project

### VPS/Cloud
1. Clone the repository
2. Set up environment variables
3. Use PM2 or similar for process management:
```bash
npm install -g pm2
pm2 start index.js --name "ticket-bot"
```

## Support

For issues or questions, please check the code comments or create an issue in the repository.