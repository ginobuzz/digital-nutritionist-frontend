import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
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
  Person,
  PhotoCamera,
  Close,
  Mic,
  StopCircle
} from '@mui/icons-material';
import Markdown from 'markdown-to-jsx';
import { format } from 'date-fns';
import { ChatMessage, User } from '../types';
import { apiService, ChatTurn, isUserNotFoundError } from '../services/api';
import { imageFileToDataUrl } from '../utils/images';
import { useSpeechToText } from '../hooks/useSpeechToText';

interface ChatProps {
  user?: User;
}

type PersistedChatMessage = Omit<ChatMessage, 'timestamp'> & { timestamp: string };

const CHAT_HISTORY_STORAGE_PREFIX = 'dn.chat.history.v1';

const Chat: React.FC<ChatProps> = ({ user }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [attachedImageDataUrl, setAttachedImageDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dictationBaseText, setDictationBaseText] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    supported: voiceSupported,
    isListening: voiceListening,
    interimTranscript,
    finalTranscript,
    error: voiceRawError,
    start: startVoice,
    stop: stopVoice,
    reset: resetVoice,
  } = useSpeechToText({ lang: 'en-US', continuous: false, interimResults: true });

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

  const buildWelcomeMessage = useCallback((): ChatMessage => {
    const firstName = user?.name?.split(' ')?.[0]?.trim();
    const greeting = firstName
      ? `Hi ${firstName}! Tell me what you ate (or drank) to log it, or what you want to plan for an upcoming meal.`
      : `Hi! Tell me what you ate (or drank) to log it, or what you want to plan for an upcoming meal.`;
    return {
      id: 'welcome',
      text: greeting,
      sender: 'ai',
      timestamp: new Date(),
      type: 'reminder',
    };
  }, [user?.name]);

  const toUserFacingErrorMessage = useCallback((raw: string) => {
    if (!raw.startsWith('API request failed:')) return raw;
    const splitIndex = raw.indexOf(' - ');
    if (splitIndex === -1) return 'Sorry — something went wrong.';
    return raw.slice(splitIndex + 3).trim() || 'Sorry — something went wrong.';
  }, []);

  const getMarkdownText = (message: ChatMessage) => {
    if (message.sender !== 'ai') return message.text;
    if (message.text.includes('\n- ')) return message.text;
    return message.text.replace(/ - (?=\*\*)/g, '\n- ');
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
  }, [storageKey, buildWelcomeMessage]);

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
    const trimmed = inputMessage.trim();
    const hasImage = Boolean(attachedImageDataUrl);
    if (!trimmed && !hasImage) return;

    const history: ChatTurn[] = messages
      .slice(-10)
      .map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.imageDataUrl ? `${m.text}\n[User attached a meal photo]` : m.text,
      }));

    const outgoingText = trimmed || 'Here is a photo of my meal.';

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: outgoingText,
      sender: 'user',
      timestamp: new Date(),
      type: 'meal_log',
      imageDataUrl: attachedImageDataUrl ?? undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setAttachedImageDataUrl(null);
    setLoading(true);

    try {
      const client_time_zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const client_local_date = format(new Date(), 'yyyy-MM-dd');
      const response = await apiService.chat({
        message: outgoingText,
        user_id: activeUserId ?? undefined,
        history,
        client_local_date,
        client_time_zone,
        image_data_url: userMessage.imageDataUrl,
      });

      const createdLogsCount = response.created_meal_logs?.length ?? 0;
      const createdPlannedCount = response.created_planned_meals?.length ?? 0;
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: response.reply || 'OK.',
        sender: 'ai',
        timestamp: new Date(),
        type: createdLogsCount > 0 ? 'encouragement' : createdPlannedCount > 0 ? 'planning' : 'general',
      };
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      if (isUserNotFoundError(error)) {
        return;
      }
      const rawMessage = error instanceof Error ? error.message : 'Sorry — something went wrong.';
      const message = toUserFacingErrorMessage(rawMessage);
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

  const handleAttachImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Allow selecting the same file again.
    event.target.value = '';
    if (!file) return;

    try {
      const dataUrl = await imageFileToDataUrl(file);
      setAttachedImageDataUrl(dataUrl);
    } catch (error) {
      console.error('Unable to attach image:', error);
    }
  };

  useEffect(() => {
    const transcript = [finalTranscript, interimTranscript].filter(Boolean).join(' ').trim();
    if (!dictationBaseText && !transcript) return;

    const needsSpace = dictationBaseText.length > 0 && !/\s$/.test(dictationBaseText);
    setInputMessage(`${dictationBaseText}${needsSpace && transcript ? ' ' : ''}${transcript}`);
  }, [dictationBaseText, finalTranscript, interimTranscript]);

  useEffect(() => {
    if (!voiceRawError) return;

    if (voiceRawError === 'unsupported') {
      setVoiceError('Voice input isn’t supported in this browser.');
      return;
    }

    switch (voiceRawError) {
      case 'not-allowed':
      case 'service-not-allowed':
        setVoiceError('Microphone permission blocked. Enable it in your browser settings.');
        return;
      case 'no-speech':
        setVoiceError('No speech detected. Try again.');
        return;
      case 'audio-capture':
        setVoiceError('No microphone detected.');
        return;
      case 'network':
        setVoiceError('Network error while using voice input.');
        return;
      case 'language-not-supported':
        setVoiceError('Language not supported for voice input.');
        return;
      default:
        setVoiceError(`Voice input error: ${voiceRawError}`);
    }
  }, [voiceRawError]);

  const handleToggleVoice = () => {
    setVoiceError(null);

    if (!voiceSupported) {
      setVoiceError('Voice input isn’t supported in this browser.');
      return;
    }

    if (voiceListening) {
      stopVoice();
      return;
    }

    resetVoice();
    setDictationBaseText(inputMessage);
    startVoice();
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
                        backgroundColor: message.sender === 'user' ? 'primary.dark' : 'grey.100',
                        color: (theme) =>
                          message.sender === 'user'
                            ? theme.palette.primary.contrastText
                            : theme.palette.text.primary,
                        borderRadius: 2,
                        wordBreak: 'break-word'
                      }}
                    >
                      <Box
                        sx={{
                          '& p': { m: 0 },
                          '& ul, & ol': { m: 0, pl: 3 },
                          '& li': { mb: 0.5 },
                          '& li:last-child': { mb: 0 },
                          '& a': { color: 'inherit' },
                          '& code': {
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                            fontSize: '0.9em',
                          },
                          '& pre': {
                            overflowX: 'auto',
                            p: 1,
                            borderRadius: 1,
                            backgroundColor: message.sender === 'user' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)',
                          },
                          '& pre code': { fontSize: '0.85em' },
                        }}
                      >
                        {message.imageDataUrl && (
                          <Box
                            component="img"
                            src={message.imageDataUrl}
                            alt="Meal"
                            sx={{
                              display: 'block',
                              width: '100%',
                              maxWidth: 360,
                              borderRadius: 1.5,
                              mb: 1.25,
                              border: '1px solid rgba(0,0,0,0.08)',
                            }}
                          />
                        )}
                        <Markdown
                          options={{
                            disableParsingRawHTML: true,
                            forceBlock: true,
                          }}
                        >
                          {getMarkdownText(message)}
                        </Markdown>
                      </Box>
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
            {attachedImageDataUrl && (
              <Box sx={{ mb: 1.25, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Box
                  component="img"
                  src={attachedImageDataUrl}
                  alt="Selected meal"
                  sx={{
                    width: 88,
                    height: 88,
                    objectFit: 'cover',
                    borderRadius: 1.5,
                    border: '1px solid rgba(0,0,0,0.10)',
                  }}
                />
                <IconButton
                  size="small"
                  onClick={() => setAttachedImageDataUrl(null)}
                  disabled={loading}
                  aria-label="Remove image"
                >
                  <Close fontSize="small" />
                </IconButton>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              <IconButton
                component="label"
                disabled={loading || voiceListening}
                color={attachedImageDataUrl ? 'primary' : 'default'}
                aria-label="Attach meal photo"
                sx={{ alignSelf: 'flex-end' }}
              >
                <PhotoCamera />
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  capture="environment"
                  onChange={handleAttachImage}
                />
              </IconButton>
              <IconButton
                onClick={handleToggleVoice}
                disabled={loading}
                color={voiceListening ? 'error' : 'default'}
                aria-label={voiceListening ? 'Stop voice input' : 'Start voice input'}
                sx={{ alignSelf: 'flex-end' }}
              >
                {voiceListening ? <StopCircle /> : <Mic />}
              </IconButton>
              <TextField
                fullWidth
                multiline
                maxRows={4}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Log what you ate/drank, plan meals, or ask nutrition questions..."
                variant="outlined"
                size="small"
                disabled={loading || voiceListening}
              />
              <IconButton
                onClick={handleSendMessage}
                disabled={(!(inputMessage.trim() || attachedImageDataUrl) || loading || voiceListening)}
                color="primary"
                aria-label="Send message"
                sx={{ alignSelf: 'flex-end' }}
              >
                <Send />
              </IconButton>
            </Box>

            {voiceListening && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Listening… tap the mic to stop.
              </Typography>
            )}

            {voiceError && (
              <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                {voiceError}
              </Typography>
            )}
            
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Try: "I had oatmeal for breakfast" • "Help me plan dinners for the week" • "What's a good high-protein snack?"
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Chat; 
