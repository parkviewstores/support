const { 
  Client, 
  GatewayIntentBits, 
  PermissionFlagsBits, 
  ChannelType,
  SlashCommandBuilder,
  EmbedBuilder,
  ActivityType
} = require('discord.js');
require('dotenv').config();

class TicketBot {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
      ]
    });

    // Map to store user ID -> ticket channel ID relationships
    this.userTickets = new Map();
    // Map to store ticket channel ID -> user ID relationships (reverse lookup)
    this.ticketUsers = new Map();

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.client.once('ready', () => this.onReady());
    this.client.on('messageCreate', (message) => this.onMessage(message));
    this.client.on('interactionCreate', (interaction) => this.onInteraction(interaction));
  }

  async onReady() {
    console.log(`✅ ${this.client.user.tag} is online and ready!`);
    console.log(`📊 Serving ${this.client.guilds.cache.size} guild(s)`);
    
    // Debug: Log guild and configuration info
    const guild = this.client.guilds.cache.get(process.env.GUILD_ID);
    if (guild) {
      console.log(`🏠 Connected to guild: ${guild.name} (${guild.id})`);
      
      const category = guild.channels.cache.get(process.env.CATEGORY_ID);
      const staffRole = guild.roles.cache.get(process.env.STAFF_ROLE_ID);
      
      console.log(`📁 Category found: ${category ? `${category.name} (${category.id})` : '❌ NOT FOUND'}`);
      console.log(`👥 Staff role found: ${staffRole ? `${staffRole.name} (${staffRole.id})` : '❌ NOT FOUND'}`);
    } else {
      console.log(`❌ Guild not found with ID: ${process.env.GUILD_ID}`);
    }
    
    // Set bot activity
    this.client.user.setActivity('DMs for tickets', { type: ActivityType.Watching });

    // Register slash commands
    await this.registerCommands();
  }

  async registerCommands() {
    try {
      const guild = this.client.guilds.cache.get(process.env.GUILD_ID);
      if (!guild) {
        console.error('❌ Could not find guild with ID:', process.env.GUILD_ID);
        return;
      }

      const closeCommand = new SlashCommandBuilder()
        .setName('close')
        .setDescription('Close the current ticket channel');

      await guild.commands.set([closeCommand]);
      console.log('✅ Slash commands registered successfully');
    } catch (error) {
      console.error('❌ Error registering commands:', error);
    }
  }

  async onMessage(message) {
    // Ignore bot messages
    if (message.author.bot) return;
    
    console.log(`📨 Message received from ${message.author.tag} in ${message.channel.type === ChannelType.DM ? 'DM' : `#${message.channel.name}`}`);

    try {
      // Handle DM messages from users
      if (message.channel.type === ChannelType.DM) {
        console.log(`💬 Processing DM from ${message.author.tag}: "${message.content}"`);
        await this.handleUserDM(message);
      }
      // Handle messages in ticket channels from staff
      else if (message.guild && message.guild.id === process.env.GUILD_ID) {
        await this.handleStaffReply(message);
      }
    } catch (error) {
      console.error('❌ Error handling message:', error);
      
      // Try to notify the user about the error
      if (message.channel.type === ChannelType.DM) {
        try {
          await message.channel.send('❌ Sorry, there was an error processing your message. Please try again or contact an administrator.');
        } catch (dmError) {
          console.error('❌ Could not send error message to user:', dmError);
        }
      }
    }
  }

  async handleUserDM(message) {
    console.log(`🎫 Handling DM from user ${message.author.tag} (${message.author.id})`);
    
    const userId = message.author.id;
    let ticketChannel = null;

    // Check if user already has a ticket
    if (this.userTickets.has(userId)) {
      console.log(`📋 User ${message.author.tag} already has a ticket`);
      const channelId = this.userTickets.get(userId);
      ticketChannel = this.client.channels.cache.get(channelId);
      
      // If channel doesn't exist anymore, remove from map
      if (!ticketChannel) {
        console.log(`🗑️ Ticket channel no longer exists, removing from map`);
        this.userTickets.delete(userId);
        this.ticketUsers.delete(channelId);
      }
    }

    // Create new ticket if none exists
    if (!ticketChannel) {
      console.log(`🆕 Creating new ticket for ${message.author.tag}`);
      ticketChannel = await this.createTicketChannel(message.author);
      if (!ticketChannel) return;
    }

    // Mirror the message to the ticket channel
    console.log(`🔄 Mirroring message to ticket channel`);
    await this.mirrorMessageToTicket(message, ticketChannel);

    // React with checkmark to user's DM
    try {
      await message.react('✅');
      console.log(`✅ Reacted to user's DM`);
    } catch (error) {
      console.error('❌ Error reacting to DM:', error);
    }
  }

  async createTicketChannel(user) {
    console.log(`🏗️ Creating ticket channel for ${user.tag}`);
    
    try {
      const guild = this.client.guilds.cache.get(process.env.GUILD_ID);
      const category = guild.channels.cache.get(process.env.CATEGORY_ID);
      const staffRole = guild.roles.cache.get(process.env.STAFF_ROLE_ID);

      if (!guild || !category || !staffRole) {
        console.error('❌ Missing required components:');
        console.error(`   Guild: ${guild ? '✅' : '❌'} (${process.env.GUILD_ID})`);
        console.error(`   Category: ${category ? '✅' : '❌'} (${process.env.CATEGORY_ID})`);
        console.error(`   Staff Role: ${staffRole ? '✅' : '❌'} (${process.env.STAFF_ROLE_ID})`);
        return null;
      }

      // Create channel name (sanitize username)
      const channelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      console.log(`📝 Creating channel with name: ${channelName}`);

      // Create the ticket channel
      const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: staffRole.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          },
          {
            id: this.client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          }
        ]
      });

      // Store the mapping
      this.userTickets.set(user.id, ticketChannel.id);
      this.ticketUsers.set(ticketChannel.id, user.id);
      console.log(`💾 Stored ticket mapping: ${user.id} -> ${ticketChannel.id}`);

      // Send welcome message in ticket channel
      const welcomeEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🎫 New Ticket Created')
        .setDescription(`Ticket created for ${user.tag} (${user.id})`)
        .addFields([
          { name: '👤 User', value: user.tag, inline: true },
          { name: '🆔 User ID', value: user.id, inline: true },
          { name: '📅 Created', value: new Date().toLocaleString(), inline: true }
        ])
        .setThumbnail(user.displayAvatarURL())
        .setTimestamp();

      await ticketChannel.send({ 
        content: `<@&${process.env.STAFF_ROLE_ID}> New ticket created!`,
        embeds: [welcomeEmbed] 
      });

      console.log(`✅ Created ticket channel ${channelName} for user ${user.tag}`);
      return ticketChannel;

    } catch (error) {
      console.error('❌ Error creating ticket channel:', error);
      
      // Try to DM the user about the error
      try {
        await user.send('❌ Sorry, there was an error creating your ticket. Please try again later or contact an administrator.');
      } catch (dmError) {
        console.error('❌ Could not DM user about ticket creation error:', dmError);
      }
      
      return null;
    }
  }

  async mirrorMessageToTicket(message, ticketChannel) {
    try {
      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL()
        })
        .setDescription(message.content || '*No text content*')
        .setTimestamp()
        .setFooter({ text: 'User Message' });

      const messageOptions = { embeds: [embed] };

      // Handle attachments
      if (message.attachments.size > 0) {
        const attachmentList = message.attachments.map(att => `[${att.name}](${att.url})`).join('\n');
        embed.addFields([{ name: '📎 Attachments', value: attachmentList }]);
      }

      await ticketChannel.send(messageOptions);
    } catch (error) {
      console.error('❌ Error mirroring message to ticket:', error);
    }
  }

  async handleStaffReply(message) {
    // Check if this is a ticket channel
    const userId = this.ticketUsers.get(message.channel.id);
    if (!userId) return;

    // Check if user has staff role
    const member = message.member;
    if (!member || !member.roles.cache.has(process.env.STAFF_ROLE_ID)) {
      return;
    }

    try {
      const user = await this.client.users.fetch(userId);
      if (!user) return;

      const embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setAuthor({
          name: `Staff: ${message.author.tag}`,
          iconURL: message.author.displayAvatarURL()
        })
        .setDescription(message.content || '*No text content*')
        .setTimestamp()
        .setFooter({ text: 'Staff Response' });

      const messageOptions = { embeds: [embed] };

      // Handle attachments
      if (message.attachments.size > 0) {
        const attachmentList = message.attachments.map(att => `[${att.name}](${att.url})`).join('\n');
        embed.addFields([{ name: '📎 Attachments', value: attachmentList }]);
      }

      await user.send(messageOptions);
      console.log(`📩 Mirrored staff reply from ${message.author.tag} to user ${user.tag}`);
    } catch (error) {
      console.error('❌ Error mirroring staff reply to user DM:', error);
      
      // Notify in the ticket channel that the message couldn't be delivered
      try {
        await message.channel.send('⚠️ **Warning:** Could not deliver this message to the user. They may have DMs disabled or have left the server.');
      } catch (notifyError) {
        console.error('❌ Could not send delivery warning:', notifyError);
      }
    }
  }

  async onInteraction(interaction) {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'close') {
      await this.handleCloseCommand(interaction);
    }
  }

  async handleCloseCommand(interaction) {
    try {
      // Check if user has staff role
      const member = interaction.member;
      if (!member || !member.roles.cache.has(process.env.STAFF_ROLE_ID)) {
        await interaction.reply({
          content: '❌ You do not have permission to use this command.',
          ephemeral: true
        });
        return;
      }

      // Check if this is a ticket channel
      const userId = this.ticketUsers.get(interaction.channel.id);
      if (!userId) {
        await interaction.reply({
          content: '❌ This command can only be used in ticket channels.',
          ephemeral: true
        });
        return;
      }

      await interaction.reply('🔄 Closing ticket...');

      try {
        // Notify the user
        const user = await this.client.users.fetch(userId);
        if (user) {
          const closeEmbed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('🎫 Ticket Closed')
            .setDescription('This ticket has been closed by our staff team.')
            .addFields([
              { name: '👤 Closed by', value: interaction.user.tag, inline: true },
              { name: '📅 Closed at', value: new Date().toLocaleString(), inline: true }
            ])
            .setTimestamp();

          await user.send({ embeds: [closeEmbed] });
          console.log(`📩 Notified user ${user.tag} about ticket closure`);
        }
      } catch (dmError) {
        console.error('❌ Could not DM user about ticket closure:', dmError);
        await interaction.followUp('⚠️ **Warning:** Could not notify the user about ticket closure.');
      }

      // Clean up mappings
      this.userTickets.delete(userId);
      this.ticketUsers.delete(interaction.channel.id);

      // Delete the channel after a short delay
      setTimeout(async () => {
        try {
          await interaction.channel.delete();
          console.log(`✅ Deleted ticket channel ${interaction.channel.name}`);
        } catch (deleteError) {
          console.error('❌ Error deleting ticket channel:', deleteError);
        }
      }, 3000);

    } catch (error) {
      console.error('❌ Error handling close command:', error);
      await interaction.reply({
        content: '❌ An error occurred while closing the ticket.',
        ephemeral: true
      });
    }
  }

  async start() {
    try {
      await this.client.login(process.env.TOKEN);
    } catch (error) {
      console.error('❌ Failed to login:', error);
      process.exit(1);
    }
  }
}

// Validate environment variables
function validateEnvironment() {
  const required = ['TOKEN', 'GUILD_ID', 'CATEGORY_ID', 'STAFF_ROLE_ID'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('📝 Please check your .env file and ensure all variables are set.');
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down bot...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
});

// Start the bot
console.log('🚀 Starting Discord Ticket Bot...');
validateEnvironment();

const bot = new TicketBot();
bot.start();