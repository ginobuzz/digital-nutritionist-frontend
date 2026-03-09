import React from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  FormControlLabel,
  Radio,
  RadioGroup,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import StopCircleRoundedIcon from '@mui/icons-material/StopCircleRounded';
import Markdown from 'markdown-to-jsx';

export type MealType = '' | 'breakfast' | 'lunch' | 'dinner' | 'snack';

interface MealLogInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  imageDataUrl: string | null;
  onImageRemove: () => void;
  onImageAttach: (event: React.ChangeEvent<HTMLInputElement>) => void;
  mealType: MealType;
  onMealTypeChange: (type: MealType) => void;
  voiceListening: boolean;
  voiceError: string | null;
  onVoiceToggle: () => void;
  busy: boolean;
  reply: string | null;
  inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  photoInputRef?: React.RefObject<HTMLInputElement | null>;
  radioGroupName?: string;
  textFieldLabel?: string;
  placeholder?: string;
}

const MealLogInput: React.FC<MealLogInputProps> = ({
  value,
  onChange,
  onSubmit,
  imageDataUrl,
  onImageRemove,
  onImageAttach,
  mealType,
  onMealTypeChange,
  voiceListening,
  voiceError,
  onVoiceToggle,
  busy,
  reply,
  inputRef,
  photoInputRef,
  radioGroupName = 'meal-type',
  textFieldLabel,
  placeholder,
}) => {
  const theme = useTheme();

  const resolvedLabel =
    textFieldLabel ?? (imageDataUrl ? 'Add a note (optional)' : 'Describe what you ate (or drank)');
  const resolvedPlaceholder =
    placeholder ??
    (imageDataUrl
      ? 'Optional: any details the photo won\'t show (portion, sauces, drinks, etc.)'
      : 'Example: chicken burrito bowl with rice, beans, guac and a Coke');

  return (
    <>
      {imageDataUrl && (
        <Box sx={{ mb: 1.25, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Box
            component="img"
            src={imageDataUrl}
            alt="Selected meal"
            sx={{
              width: 88,
              height: 88,
              objectFit: 'cover',
              borderRadius: 1.5,
              border: `1px solid ${alpha(theme.palette.text.primary, 0.12)}`,
            }}
          />
          <IconButton
            size="small"
            onClick={onImageRemove}
            disabled={busy}
            aria-label="Remove meal photo"
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignSelf: 'center' }}>
          <IconButton
            component="label"
            disabled={busy || voiceListening}
            color={imageDataUrl ? 'primary' : 'default'}
            aria-label="Attach meal photo"
          >
            <PhotoCameraRoundedIcon />
            <input
              ref={photoInputRef}
              hidden
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onImageAttach}
            />
          </IconButton>
          <IconButton
            onClick={onVoiceToggle}
            disabled={busy}
            color={voiceListening ? 'error' : 'default'}
            aria-label={voiceListening ? 'Stop voice input' : 'Start voice input'}
          >
            {voiceListening ? <StopCircleRoundedIcon /> : <MicRoundedIcon />}
          </IconButton>
        </Box>
        <TextField
          fullWidth
          margin="dense"
          label={resolvedLabel}
          placeholder={resolvedPlaceholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey) return;
            if (event.nativeEvent.isComposing) return;
            event.preventDefault();
            if (busy || voiceListening) return;
            onSubmit();
          }}
          multiline
          minRows={3}
          disabled={busy || voiceListening}
          InputLabelProps={{ shrink: true, sx: { whiteSpace: 'nowrap' } }}
          inputRef={inputRef}
        />
      </Box>

      <Box sx={{ mt: 1.25 }}>
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', fontWeight: 800, display: 'block', mb: 0.75 }}
        >
          Meal (optional)
        </Typography>
        <RadioGroup
          row
          value={mealType}
          onChange={(event) => onMealTypeChange(event.target.value as MealType)}
          aria-label="Meal type"
          name={radioGroupName}
          sx={{ gap: { xs: 0.5, sm: 1 }, flexWrap: 'nowrap', overflowX: 'auto', pb: 0.25 }}
        >
          {(
            [
              { value: 'breakfast', label: 'Breakfast' },
              { value: 'lunch', label: 'Lunch' },
              { value: 'dinner', label: 'Dinner' },
              { value: 'snack', label: 'Snack' },
            ] as const
          ).map((option) => {
            const selected = mealType === option.value;
            return (
              <FormControlLabel
                key={option.value}
                value={option.value}
                disabled={busy}
                control={<Radio size="small" />}
                label={option.label}
                sx={{
                  m: 0,
                  pl: { xs: 0.75, sm: 1 },
                  pr: { xs: 0.9, sm: 1.25 },
                  py: { xs: 0.2, sm: 0.25 },
                  borderRadius: 999,
                  border: `1px solid ${alpha(
                    selected ? theme.palette.primary.main : theme.palette.text.primary,
                    selected ? 0.45 : 0.14
                  )}`,
                  bgcolor: alpha(
                    selected ? theme.palette.primary.main : theme.palette.text.primary,
                    selected ? 0.08 : 0.03
                  ),
                  '& .MuiRadio-root': { p: { xs: 0.35, sm: 0.5 } },
                  '& .MuiSvgIcon-root': { fontSize: { xs: 18, sm: 20 } },
                  '& .MuiTypography-root': { fontWeight: 800, fontSize: { xs: 12, sm: 13 } },
                }}
              />
            );
          })}
        </RadioGroup>
      </Box>

      {voiceListening && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
          Listening… tap the mic to stop.
        </Typography>
      )}

      {voiceError && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.75 }}>
          {voiceError}
        </Typography>
      )}

      {reply && (
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.info.main, 0.06),
            border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
            '& p': { m: 0 },
            '& ul, & ol': { m: 0, pl: 3 },
            '& li': { mb: 0.5 },
            '& li:last-child': { mb: 0 },
            '& a': { color: 'inherit' },
            '& code': {
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: '0.9em',
            },
            '& pre': {
              overflowX: 'auto',
              p: 1,
              borderRadius: 1,
              backgroundColor: 'rgba(0,0,0,0.06)',
            },
            '& pre code': { fontSize: '0.85em' },
          }}
        >
          <Markdown>{reply}</Markdown>
        </Box>
      )}
    </>
  );
};

export default MealLogInput;
