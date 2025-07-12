import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Paper,
  Chip,
  Divider
} from '@mui/material';
import {
  Send,
  SmartToy,
  Person
} from '@mui/icons-material';
import { ChatMessage } from '../types';
import { mockAPI } from '../data/mockData';

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const chatMessages = await mockAPI.getChatMessages();
        setMessages(chatMessages);
      } catch (error) {
        console.error('Error fetching chat messages:', error);
      }
    };

    fetchMessages();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date(),
      type: 'meal_log'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: generateAIResponse(inputMessage),
        sender: 'ai',
        timestamp: new Date(),
        type: 'encouragement'
      };
      setMessages(prev => [...prev, aiResponse]);
      setLoading(false);
    }, 1000);
  };

  const generateAIResponse = (userInput: string): string => {
    const lowerInput = userInput.toLowerCase();
    
    if (lowerInput.includes('breakfast') || lowerInput.includes('ate') || lowerInput.includes('had')) {
      return "Great! I've logged your meal. How are you feeling about your food choices today? 😊";
    } else if (lowerInput.includes('lunch')) {
      return "Perfect! I've updated your lunch log. You're doing great with staying mindful of your nutrition! 🥗";
    } else if (lowerInput.includes('dinner')) {
      return "Excellent! I've recorded your dinner. You're making great progress toward your goals! 🌟";
    } else if (lowerInput.includes('exercise') || lowerInput.includes('workout') || lowerInput.includes('run')) {
      return "That's fantastic! Exercise is such an important part of your journey. I've logged your activity! 💪";
    } else if (lowerInput.includes('weight') || lowerInput.includes('scale')) {
      return "Thanks for updating your weight! I can see you're making steady progress. Keep up the great work! 📊";
    } else if (lowerInput.includes('help') || lowerInput.includes('advice')) {
      return "I'm here to help! You can log meals, track exercise, or ask me about nutrition. What would you like to know? 🤔";
    } else {
      return "Thanks for sharing! I'm here to support you on your nutrition journey. Is there anything specific you'd like to track or discuss? 💬";
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const getMessageTypeColor = (type: ChatMessage['type']) => {
    switch (type) {
      case 'meal_log':
        return 'primary';
      case 'planning':
        return 'secondary';
      case 'encouragement':
        return 'success';
      case 'reminder':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h4" gutterBottom>
        Chat with Your AI Coach 💬
      </Typography>
      
      <Card sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 0 }}>
          {/* Messages Area */}
          <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2, maxHeight: 'calc(100vh - 300px)' }}>
            <List>
              {messages.map((message) => (
                <ListItem
                  key={message.id}
                  sx={{
                    flexDirection: message.sender === 'user' ? 'row-reverse' : 'row',
                    alignItems: 'flex-start',
                    mb: 1
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ 
                      bgcolor: message.sender === 'ai' ? 'primary.main' : 'secondary.main',
                      width: 40,
                      height: 40
                    }}>
                      {message.sender === 'ai' ? <SmartToy /> : <Person />}
                    </Avatar>
                  </ListItemAvatar>
                  
                  <Box sx={{ 
                    maxWidth: '70%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: message.sender === 'user' ? 'flex-end' : 'flex-start'
                  }}>
                    <Paper
                      elevation={1}
                      sx={{
                        p: 2,
                        backgroundColor: message.sender === 'user' ? 'primary.light' : 'grey.100',
                        color: message.sender === 'user' ? 'white' : 'text.primary',
                        borderRadius: 2,
                        wordBreak: 'break-word'
                      }}
                    >
                      <Typography variant="body1">
                        {message.text}
                      </Typography>
                    </Paper>
                    
                    <Box sx={{ mt: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Chip
                        label={message.type.replace('_', ' ')}
                        size="small"
                        color={getMessageTypeColor(message.type) as any}
                        variant="outlined"
                      />
                      <Typography variant="caption" color="text.secondary">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </Typography>
                    </Box>
                  </Box>
                </ListItem>
              ))}
              
              {loading && (
                <ListItem sx={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
                      <SmartToy />
                    </Avatar>
                  </ListItemAvatar>
                  <Paper
                    elevation={1}
                    sx={{
                      p: 2,
                      backgroundColor: 'grey.100',
                      borderRadius: 2
                    }}
                  >
                    <Typography variant="body1">
                      Typing...
                    </Typography>
                  </Paper>
                </ListItem>
              )}
              
              <div ref={messagesEndRef} />
            </List>
          </Box>
          
          <Divider />
          
          {/* Input Area */}
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                multiline
                maxRows={4}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Tell me about your meals, exercise, or ask for advice..."
                variant="outlined"
                size="small"
                disabled={loading}
              />
              <IconButton
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || loading}
                color="primary"
                sx={{ alignSelf: 'flex-end' }}
              >
                <Send />
              </IconButton>
            </Box>
            
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Try: "I had oatmeal for breakfast" • "Just finished a 30-minute run" • "What should I eat for dinner?"
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Chat; 