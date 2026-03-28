// Translations for the app
// Supports English, Shona, and Ndebele
// Written to sound natural like actual kombi conductors speak

export type Language = 'en' | 'sn' | 'nd';

export interface Translations {
  // Common
  app_name: string;
  loading: string;
  error: string;
  success: string;
  cancel: string;
  confirm: string;
  back: string;
  next: string;
  done: string;
  save: string;
  
  // Announcements - Written to sound natural and conversational
  announcement_all_aboard: string;
  announcement_trip_starting: string;
  announcement_approaching_dropoff: string;
  announcement_arrived_dropoff: string;
  announcement_final_destination: string;
  announcement_thank_you: string;
  announcement_next_stop: string;
  announcement_please_prepare: string;
  
  // Trip related
  trip_in_progress: string;
  passengers_onboard: string;
  destination: string;
  pickup_point: string;
  dropoff_point: string;
  
  // Language names
  language_english: string;
  language_shona: string;
  language_ndebele: string;
  
  // Settings
  settings: string;
  language: string;
  voice_announcements: string;
  announcement_volume: string;
}

export const translations: Record<Language, Translations> = {
  // English - Friendly, conversational tone
  en: {
    app_name: 'Ndeip-Zthin',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
    confirm: 'Confirm',
    back: 'Back',
    next: 'Next',
    done: 'Done',
    save: 'Save',
    
    // Announcements - Natural, friendly tone
    announcement_all_aboard: 'Alright everyone, we are all in! Let\'s go!',
    announcement_trip_starting: 'Welcome everyone! Off we go!',
    announcement_approaching_dropoff: 'Hey {name}, we\'re almost at {location}. Get ready to hop off!',
    announcement_arrived_dropoff: '{name}, here we are at {location}! Thanks for riding with us, take care!',
    announcement_final_destination: 'And we\'ve made it to {location}! Thanks everyone for riding with us today!',
    announcement_thank_you: 'Thanks for choosing us! Safe travels!',
    announcement_next_stop: 'Coming up next, {location}!',
    announcement_please_prepare: 'Get ready, your stop is coming up!',
    
    // Trip related
    trip_in_progress: 'Trip in progress',
    passengers_onboard: '{count} passengers onboard',
    destination: 'Destination',
    pickup_point: 'Pickup point',
    dropoff_point: 'Drop-off point',
    
    // Language names
    language_english: 'English',
    language_shona: 'Shona',
    language_ndebele: 'Ndebele',
    
    // Settings
    settings: 'Settings',
    language: 'Language',
    voice_announcements: 'Voice Announcements',
    announcement_volume: 'Announcement Volume',
  },

  // Shona - Natural kombi/hwindi style
  // Written as people actually speak, not formal textbook Shona
  sn: {
    app_name: 'Ndeip-Zthin',
    loading: 'Hona apa...',
    error: 'Pane chakaipa',
    success: 'Zvaita',
    cancel: 'Rega',
    confirm: 'Ehe ndizvo',
    back: 'Dzoka',
    next: 'Enderei',
    done: 'Tapedza',
    save: 'Sevha',
    
    // Announcements - Like a friendly hwindi would speak
    announcement_all_aboard: 'Takwira vese! Toenda iye zvino!',
    announcement_trip_starting: 'Tiri kubuda vanhu! Endai zvakanaka!',
    announcement_approaching_dropoff: 'Iwe {name}! Tava kuda kusvika pa{location}. Gadzirira kuburuka!',
    announcement_arrived_dropoff: '{name}, tasvika pa{location}! Famba zvakanaka, tichaonana!',
    announcement_final_destination: 'Tasvika vanhu, apa ndiyo {location}! Maita basa nekufamba nesu!',
    announcement_thank_you: 'Tatenda! Fambai zvakanaka!',
    announcement_next_stop: 'Tava kusvika pa{location}!',
    announcement_please_prepare: 'Gadzirira shamwari, tava pedyo!',
    
    // Trip related
    trip_in_progress: 'Tiri munzira',
    passengers_onboard: 'Vanhu {count} vakwira',
    destination: 'Kwatinoenda',
    pickup_point: 'Pekutora',
    dropoff_point: 'Pekuburuka',
    
    // Language names
    language_english: 'Chirungu',
    language_shona: 'ChiShona',
    language_ndebele: 'IsiNdebele',
    
    // Settings
    settings: 'Masettings',
    language: 'Mutauro',
    voice_announcements: 'Kuzivisa neVoice',
    announcement_volume: 'Volume yeVoice',
  },

  // Ndebele - Natural conversational style
  // Written as people speak in Bulawayo/Matabeleland
  nd: {
    app_name: 'Ndeip-Zthin',
    loading: 'Lindela...',
    error: 'Kulenkinga',
    success: 'Kuhle',
    cancel: 'Yekela',
    confirm: 'Yebo kunjalo',
    back: 'Buyela',
    next: 'Qhubeka',
    done: 'Siphelile',
    save: 'Gcina',
    
    // Announcements - Like a friendly Ndebele conductor
    announcement_all_aboard: 'Sesingene sonke! Siyahamba manje!',
    announcement_trip_starting: 'Sihambe bantu! Hambani kuhle!',
    announcement_approaching_dropoff: 'Wena {name}! Sesifika e{location}. Lungiselela ukwehla!',
    announcement_arrived_dropoff: '{name}, nansi i{location}! Hamba kuhle mngane, sizabonana!',
    announcement_final_destination: 'Sifikile bantu, le yi{location}! Siyabonga ngokuhamba lathi!',
    announcement_thank_you: 'Sibonga kakhulu! Hambani kuhle!',
    announcement_next_stop: 'Sesisondela e{location}!',
    announcement_please_prepare: 'Lungiselela mngane, sesifikile!',
    
    // Trip related
    trip_in_progress: 'Siyahamba',
    passengers_onboard: 'Abantu abangu {count} sebengene',
    destination: 'Lapho esiya khona',
    pickup_point: 'Indawo yokuthatha',
    dropoff_point: 'Indawo yokwehla',
    
    // Language names
    language_english: 'IsiNgisi',
    language_shona: 'IsiShona',
    language_ndebele: 'IsiNdebele',
    
    // Settings
    settings: 'Amasettings',
    language: 'Ulimi',
    voice_announcements: 'Ukumemezela ngeVoice',
    announcement_volume: 'IVolume yeVoice',
  },
};

// Helper function to get translation with variable substitution
export function t(
  language: Language,
  key: keyof Translations,
  variables?: Record<string, string | number>
): string {
  let text = translations[language][key] || translations.en[key] || key;
  
  if (variables) {
    Object.entries(variables).forEach(([varKey, value]) => {
      text = text.replace(new RegExp(`\\{${varKey}\\}`, 'g'), String(value));
    });
  }
  
  return text;
}

// Get language display name
export function getLanguageName(language: Language, inLanguage?: Language): string {
  const lang = inLanguage || language;
  switch (language) {
    case 'en': return translations[lang].language_english;
    case 'sn': return translations[lang].language_shona;
    case 'nd': return translations[lang].language_ndebele;
    default: return 'Unknown';
  }
}

// Available languages
export const availableLanguages: { code: Language; nativeName: string; flag: string }[] = [
  { code: 'en', nativeName: 'English', flag: '🇬🇧' },
  { code: 'sn', nativeName: 'ChiShona', flag: '🇿🇼' },
  { code: 'nd', nativeName: 'IsiNdebele', flag: '🇿🇼' },
];
