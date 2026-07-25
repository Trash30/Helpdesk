import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import commonFr from './locales/fr/common.json';
import ticketsFr from './locales/fr/tickets.json';
import clientsFr from './locales/fr/clients.json';
import commercialFr from './locales/fr/commercial.json';
import adminFr from './locales/fr/admin.json';
import sportsFr from './locales/fr/sports.json';
import kbFr from './locales/fr/kb.json';
import authFr from './locales/fr/auth.json';

import commonEn from './locales/en/common.json';
import ticketsEn from './locales/en/tickets.json';
import clientsEn from './locales/en/clients.json';
import commercialEn from './locales/en/commercial.json';
import adminEn from './locales/en/admin.json';
import sportsEn from './locales/en/sports.json';
import kbEn from './locales/en/kb.json';
import authEn from './locales/en/auth.json';

const savedLocale = localStorage.getItem('locale');
const initialLocale = savedLocale === 'en' ? 'en' : 'fr';

i18n.use(initReactI18next).init({
  resources: {
    fr: {
      common: commonFr,
      tickets: ticketsFr,
      clients: clientsFr,
      commercial: commercialFr,
      admin: adminFr,
      sports: sportsFr,
      kb: kbFr,
      auth: authFr,
    },
    en: {
      common: commonEn,
      tickets: ticketsEn,
      clients: clientsEn,
      commercial: commercialEn,
      admin: adminEn,
      sports: sportsEn,
      kb: kbEn,
      auth: authEn,
    },
  },
  lng: initialLocale,
  fallbackLng: 'fr',
  defaultNS: 'common',
  ns: ['common', 'tickets', 'clients', 'commercial', 'admin', 'sports', 'kb', 'auth'],
  interpolation: { escapeValue: false },
});

export default i18n;
