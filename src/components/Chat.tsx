import React, { useMemo, useState, useEffect, useRef } from 'react';
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
import { ChatMessage, User } from '../types';
import { apiService, ChatTurn } from '../services/api';

interface ChatProps {
  user?: User;
}

type PersistedChatMessage = Omit<ChatMessage, 'timestamp'> & { timestamp: string };

const CHAT_HISTORY_STORAGE_PREFIX = 'dn.chat.history.v1';

const Chat: React.FC<ChatProps> = ({ user }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const activeUserId = useMemo(() => {
    try {
      const raw = localStorage.getItem('user');
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.id || user?.id || null;
    } catch {
      return user?.id || null;
    }
  }, [user?.id]);

  const storageKey = useMemo(() => {
    return `${CHAT_HISTORY_STORAGE_PREFIX}:${activeUserId ?? 'anon'}`;
  }, [activeUserId]);

  const buildWelcomeMessage = (): ChatMessage => {
    const firstName = user?.name?.split(' ')?.[0]?.trim();
    const greeting = firstName
      ? `Hi ${firstName}! Tell me what you ate (or drank) and I’ll log it for you.`
      : `Hi! Tell me what you ate (or drank) and I’ll log it for you.`;
    return {
      id: 'welcome',
      text: greeting,
      sender: 'ai',
      timestamp: new Date(),
      type: 'reminder',
    };
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setMessages([buildWelcomeMessage()]);
        return;
      }

      const parsed = JSON.parse(raw) as { messages?: PersistedChatMessage[] } | PersistedChatMessage[];
      const persistedMessages = Array.isArray(parsed) ? parsed : (parsed.messages ?? []);
      if (!persistedMessages.length) {
        setMessages([buildWelcomeMessage()]);
        return;
      }

      setMessages(
        persistedMessages.map((m) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }))
      );
    } catch {
      setMessages([buildWelcomeMessage()]);
    }
    // Intentionally re-load when switching users (or when the user's name becomes available).
  }, [storageKey, user?.name]);

  useEffect(() => {
    if (!messages.length) return;

    try {
      const toPersist: PersistedChatMessage[] = messages.slice(-200).map((m) => ({
        ...m,
        timestamp: m.timestamp.toISOString(),
      }));
      localStorage.setItem(storageKey, JSON.stringify({ v: 1, messages: toPersist }));
    } catch {
      // Ignore persistence errors (e.g. storage full / blocked).
    }
  }, [messages, storageKey]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const history: ChatTurn[] = messages
      .slice(-10)
      .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));

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

    try {
      const response = await apiService.chat({
        message: userMessage.text,
        user_id: activeUserId ?? undefined,
        history,
      });

      const createdCount = response.created_meal_logs?.length ?? 0;
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: response.reply || 'OK.',
        sender: 'ai',
        timestamp: new Date(),
        type: createdCount > 0 ? 'encouragement' : 'general',
      };
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sorry — something went wrong.';
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: message,
        sender: 'ai',
        timestamp: new Date(),
        type: 'general',
      };
      setMessages(prev => [...prev, aiResponse]);
    } finally {
      setLoading(false);
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
