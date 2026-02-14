import React from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Typography,
  Link,
} from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';

const Legal: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', py: { xs: 3, sm: 5 } }}>
      <Container maxWidth="sm">
        <Stack spacing={2}>
          <Box>
            <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>
              Legal
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
              Privacy, terms, and consent
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
              We keep this simple and available on demand.
            </Typography>
          </Box>

          <Card variant="outlined">
            <CardContent>
              <Accordion disableGutters defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Privacy Policy
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                    Sunday Mornings stores only the data needed to run your nutrition experience and improve your progress.
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                    Data we store includes:
                  </Typography>
                  <Typography variant="body2" component="ul" sx={{ pl: 2.5, color: 'text.secondary', my: 0 }}>
                    <li>Meal logs and planned meals.</li>
                    <li>Weight logs and goals.</li>
                    <li>Chat messages with the assistant.</li>
                    <li>Food photos you upload for meal analysis.</li>
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                    We also store basic account/profile information (such as email and your setup details) so you can sign in and keep your plan personalized.
                  </Typography>
                </AccordionDetails>
              </Accordion>

              <Accordion disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Terms of Use
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                    By creating an account or continuing to use Sunday Mornings, you agree to use the app responsibly and provide accurate information where possible.
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                    You are responsible for your account credentials and activity. We may update these terms as the product evolves.
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    If you do not agree with these terms, please stop using the service.
                  </Typography>
                </AccordionDetails>
              </Accordion>

              <Accordion disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Medical disclaimer
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Sunday Mornings provides nutrition coaching information only and is <strong>not medical advice</strong>. Always seek guidance from a qualified clinician for diagnosis, treatment, medication, or medical decisions.
                  </Typography>
                </AccordionDetails>
              </Accordion>

              <Accordion disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Consent
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    By signing in or creating an account, you consent to the storage and use of your meals, weight logs, chat history, and uploaded food photos to provide coaching features inside the app.
                  </Typography>
                </AccordionDetails>
              </Accordion>
            </CardContent>
          </Card>

          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            Need this later? Find it anytime from sign-in, setup, profile, or about pages.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <Button variant="contained" fullWidth startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate(-1)}>
              Go back
            </Button>
            <Button variant="outlined" fullWidth component={RouterLink} to="/about">
              About
            </Button>
          </Stack>

          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
            Questions? Reach out to support.
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
            <Link component={RouterLink} to="/signin">Sign in</Link> · <Link component={RouterLink} to="/setup">Create account</Link>
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
};

export default Legal;
