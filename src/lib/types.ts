export type TransactionType = "sale" | "rent";

export type PropertyType =
  | "apartment"
  | "house_yard"
  | "new_build"
  | "land"
  | "commercial"
  | "other";

export type PropertyStatus = "draft" | "published" | "sold" | "rented" | "archived";

export type RenovationType = "none" | "cosmetic" | "euro" | "designer";

export type Locale = "uz" | "ru";

export type Currency = "UZS" | "USD";

export interface PropertyUtilities {
  electricity?: boolean;
  gas?: boolean;
  cold_water?: boolean;
  hot_water?: boolean;
  heating?: boolean;
  internet?: boolean;
  water?: boolean;
  sewerage?: boolean;
  custom?: string[];
}

export interface PropertyAmenities {
  furniture: boolean;
  parking: boolean;
  elevator: boolean;
  ac: boolean;
  balcony: boolean;
  internet: boolean;
  green_zone?: boolean;
  garage?: boolean;
  barn?: boolean;
  storage?: boolean;
  pool?: boolean;
  summer_kitchen?: boolean;
  garden?: boolean;
  property_features?: string[];
  [key: string]: any;
}

export interface Property {
  id: string;
  slug: string;
  title_uz: string;
  title_ru: string;
  description_uz: string;
  description_ru: string;
  note_uz?: string;
  note_ru?: string;
  address_uz: string;
  address_ru: string;
  district_name_uz: string;
  district_name_ru: string;
  district?: string;
  neighborhood?: string;
  transaction_type: TransactionType;
  deal_type?: TransactionType;
  property_type: PropertyType;
  status: PropertyStatus;
  price_uzs: number;
  price_usd: number;
  price?: number;
  currency?: Currency;
  price_negotiable?: boolean;
  area_sqm: number;
  area?: number;
  area_sotikh?: number;
  rooms?: number;
  bathrooms?: number;
  floor?: number;
  floor_number?: number;
  total_floors?: number;
  floors?: number;
  renovation?: RenovationType;
  furniture?: boolean;
  parking?: boolean;
  living_area_sqm?: number;
  living_area?: number;
  polygon?: [number, number][];
  polygon_coordinates?: [number, number][];
  views_count?: number;
  favorites_count?: number;
  contacts_count?: number;
  updated_at?: string;
  created_at: string;
  published_at?: string;
  first_published_at?: string;
  telegram_notified_at?: string;
  telegram_channel_status?: "not_published" | "published" | "error";
  telegram_channel_post_id?: number;
  images: string[];
  photos?: string[];
  main_image?: string;
  video_url?: string;
  video?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  latitude?: number;
  longitude?: number;
  utilities: PropertyUtilities;
  amenities: PropertyAmenities;
  contact_phone: string;
  contact_telegram?: string;
  telegram?: string;
  owner_phone?: string;
  realtor_id?: string;
  realtor?: Realtor;
  facade_m?: number;
  depth_m?: number;
  dimensions?: string;
  hudud_id?: string;
  is_top?: boolean;
  is_fast_sale?: boolean;
  is_good_deal?: boolean;
  badges?: PropertyBadge[];
}

export type PropertyBadge =
  | "top"
  | "arzon"
  | "tez_sotiladi"
  | "hamyonbop"
  | "narxi_tushirildi"
  | "new"
  | "yaxshi_taklif";

export interface HududItem {
  id: string;
  city_id?: string;
  name_uz: string;
  name_ru: string;
  latitude: number;
  longitude: number;
  coordinates?: [number, number][];
  display_order?: number;
  created_at?: string;
  mahallas?: string[];
}

export interface Favorite {
  id: string;
  user_id: string;
  property_id: string;
  created_at: string;
  property?: Property;
}

export type AnalyticsEventType =
  | "page_view"
  | "map_view"
  | "property_view"
  | "search"
  | "filter_used"
  | "favorite_add"
  | "favorite_remove"
  | "phone_click"
  | "telegram_click"
  | "property_share"
  | "registration"
  | "geo_visit";

export interface AnalyticsEvent {
  id?: string;
  event_type: AnalyticsEventType;
  property_id?: string;
  user_id?: string;
  session_id: string;
  device?: string;
  traffic_source?: string;
  metadata?: Record<string, any>;
  created_at?: string;
}

export interface AnalyticsKPISummary {
  total_visits: number;
  unique_visitors: number;
  phone_calls: number;
  telegram_chats: number;
  favorites_added: number;
  searches_executed: number;
  avg_session: string;
  bounce_rate: string;
}

export interface AnalyticsDeviceStat {
  name: string;
  count: number;
  percent: number;
}

export interface AnalyticsTrafficSourceStat {
  name: string;
  visits: number;
  percent: number;
  color: string;
}

export interface AnalyticsGeoStat {
  city: string;
  city_ru: string;
  region: string;
  region_ru: string;
  count: number;
  percent: number;
  is_angren: boolean;
  color: string;
}

export interface AnalyticsDemandStat {
  type_uz: string;
  type_ru: string;
  views: number;
  percentage: number;
  growth: string;
}

export interface AnalyticsDistrictStat {
  name_uz: string;
  name_ru: string;
  views: number;
  searches: number;
  supply_count: number;
  avg_price_sqm: string;
  closed_deals: number;
  avg_days_on_market: number;
  ratio: string;
  ratio_ru: string;
  ratio_color: string;
}

export interface AnalyticsOutcomesStat {
  closed_deals: number;
  sold_count: number;
  rented_count: number;
  active_supply: number;
  avg_days_on_market: number;
  conversion_rate: string;
  total_leads?: number;
}

export interface AnalyticsDashboardPayload {
  success: boolean;
  range: string;
  db_duration_ms: number;
  kpis: AnalyticsKPISummary;
  devices: AnalyticsDeviceStat[];
  traffic_sources: AnalyticsTrafficSourceStat[];
  geo_stats?: AnalyticsGeoStat[];
  angren_share_percent?: number;
  total_geo_events?: number;
  property_types_demand: AnalyticsDemandStat[];
  districts_data: AnalyticsDistrictStat[];
  outcomes: AnalyticsOutcomesStat;
  recent_events: AnalyticsEvent[];
}

export interface Realtor {
  id: string;
  name: string;
  avatar_url?: string;
  photo_url?: string;
  position_uz?: string;
  position_ru?: string;
  experience_years: number;
  specialization_uz: string;
  specialization_ru: string;
  districts: string[];
  location?: string;
  location_uz?: string;
  location_ru?: string;
  phone: string;
  telegram: string;
  instagram?: string | null;
  instagram_url?: string | null;
  bio_uz?: string;
  bio_ru?: string;
  display_order?: number;
  assigned_properties_count?: number;
  properties_count?: number;
  leads_count?: number;
  is_active: boolean;
  created_at: string;
}

export interface AdminContactInfo {
  name: string;
  phone: string;
  telegram: string;
  email: string;
  working_hours_uz: string;
  working_hours_ru: string;
  instagram?: string;
  address_uz?: string;
  address_ru?: string;
  is_configured: boolean;
}

export type UserRole = "user" | "admin" | "realtor";

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: UserRole;
  status?: "active" | "disabled";
  phone?: string;
}

export interface LeadMetadata {
  lead_type?: "property_listing_request" | "inquiry" | "contact";
  request_type?: string;
  deal_type?: TransactionType;
  property_type?: PropertyType;
  location?: string;
  description?: string;
  preferred_channel?: "phone" | "telegram";
  telegram_username?: string;
  submitted_from?: string;
  source?: string;
  [key: string]: any;
}

export interface Lead {
  id: string;
  type: "phone" | "telegram" | "inquiry" | "property_listing_request";
  property_id?: string;
  property_title?: string;
  property_slug?: string;
  realtor_id?: string;
  realtor_name?: string;
  device?: "iPhone" | "Android" | "Desktop" | "Tablet" | string;
  traffic_source?: "Instagram" | "Telegram" | "Google" | "Direct" | "Other" | string;
  client_phone?: string;
  client_name?: string;
  message?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  status: "new" | "contacted" | "in_progress" | "completed" | "cancelled" | "closed";
  realtor?: Realtor;
  property?: Property;
  metadata?: LeadMetadata;
}

export interface RegisteredUser {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  role: "admin" | "user";
  registration_date: string;
  last_activity: string;
  favorites_count: number;
  viewed_properties_count: number;
  status: "active" | "disabled";
}

export interface CMSHeroSection {
  badge_uz: string;
  badge_ru: string;
  title_uz: string;
  title_ru: string;
  subtitle_uz: string;
  subtitle_ru: string;
}

export interface CMSAboutAdvantage {
  id: string;
  title_uz: string;
  title_ru: string;
  desc_uz: string;
  desc_ru: string;
}

export interface CMSAboutSection {
  badge_uz: string;
  badge_ru: string;
  headline_uz: string;
  headline_ru: string;
  intro_p1_uz: string;
  intro_p1_ru: string;
  intro_p2_uz: string;
  intro_p2_ru: string;
  intro_p3_uz: string;
  intro_p3_ru: string;
  mission_uz: string;
  mission_ru: string;
  advantages: CMSAboutAdvantage[];
}

export interface CMSContactsSection {
  company_name: string;
  office_title_uz: string;
  office_title_ru: string;
  phone: string;
  phone_secondary?: string;
  telegram: string;
  telegram_url: string;
  email: string;
  instagram: string;
  instagram_url: string;
  address_uz: string;
  address_ru: string;
  working_hours_uz: string;
  working_hours_ru: string;
  map_coordinates: {
    lat: number;
    lng: number;
  };
  is_configured: boolean;
}

export interface CMSAnnouncementSection {
  is_active: boolean;
  type: "info" | "warning" | "success";
  text_uz: string;
  text_ru: string;
  link_url?: string;
  link_text_uz?: string;
  link_text_ru?: string;
}

export interface CMSSEOSection {
  site_title_uz: string;
  site_title_ru: string;
  meta_description_uz: string;
  meta_description_ru: string;
  keywords_uz: string;
  keywords_ru: string;
  og_image: string;
}

export interface CMSSiteSettingsSection {
  site_name: string;
  logo_url: string;
  favicon_url: string;
  default_city: string;
  default_currency: "UZS" | "USD";
  default_language: "uz" | "ru";
  map_center_lat: number;
  map_center_lng: number;
  map_default_zoom: number;
  map_default_style: "standard" | "satellite";
}

export interface CMSFullPayload {
  hero: CMSHeroSection;
  about: CMSAboutSection;
  contacts: CMSContactsSection;
  announcement: CMSAnnouncementSection;
  seo: CMSSEOSection;
  settings: CMSSiteSettingsSection;
  updated_at?: string;
}

export interface CMSContent {
  hero_title_uz: string;
  hero_title_ru: string;
  hero_subtitle_uz: string;
  hero_subtitle_ru: string;
  about_headline_uz: string;
  about_headline_ru: string;
  about_p1_uz: string;
  about_p1_ru: string;
  about_p2_uz: string;
  about_p2_ru: string;
  about_mission_uz: string;
  about_mission_ru: string;
  announcement_active: boolean;
  announcement_uz: string;
  announcement_ru: string;
  announcement_type: "info" | "warning" | "success";
}

export interface SiteSettingsData {
  site_name: string;
  logo_url: string;
  favicon_url: string;
  default_city: string;
  default_currency: "UZS" | "USD";
  default_language: "uz" | "ru";
  map_center_lat: number;
  map_center_lng: number;
  map_default_zoom: number;
  map_default_style: "standard" | "satellite";
  admin_phone: string;
  admin_telegram: string;
  admin_email: string;
  instagram: string;
  google_analytics_id: string;
  internal_tracking: boolean;
  two_factor_ready: boolean;
}

// -----------------------------------------------------------------------------
// SAVED SEARCH & ALERTS
// -----------------------------------------------------------------------------
export interface SavedSearchFilter {
  query?: string;
  transactionType?: TransactionType | "all";
  propertyType?: PropertyType | "all";
  district?: string;
  priceMin?: number;
  priceMax?: number;
  rooms?: number;
}

export interface SavedSearch {
  id: string;
  userId?: string;
  title: string;
  filters: SavedSearchFilter;
  createdAt: string;
  matchedCount?: number;
}

export interface InAppNotification {
  id: string;
  titleUz: string;
  titleRu: string;
  messageUz: string;
  messageRu: string;
  propertyId?: string;
  propertySlug?: string;
  createdAt: string;
  read: boolean;
}

// -----------------------------------------------------------------------------
// INFRASTRUCTURE / POI TYPES
// -----------------------------------------------------------------------------
export type POICategory =
  | "school"
  | "kindergarten"
  | "pharmacy"
  | "supermarket"
  | "park"
  | "bus_stop"
  | "hospital"
  | "atm"
  | "bank"
  | "education"
  | "restaurant"
  | "gas_station"
  | "sport"
  | "police"
  | "other";

export interface POIItem {
  id: string;
  nameUz: string;
  nameRu: string;
  category: POICategory;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  formattedDistance: string;
  source?: "OpenStreetMap" | "verified_fallback";
}

export interface InfrastructureSummary {
  category: POICategory;
  labelUz: string;
  labelRu: string;
  count: number;
  closestDistance: string;
  items: POIItem[];
}

export interface TelegramSubscriber {
  telegram_user_id: number;
  username?: string;
  first_name?: string;
  language: "uz" | "ru";
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface TelegramPropertyNotificationRecord {
  id: string;
  property_id: string;
  telegram_user_id: number;
  status: "pending" | "sent" | "failed" | "blocked";
  telegram_message_id?: number;
  error_message?: string;
  sent_at?: string;
  created_at: string;
}

export interface TelegramPropertyNotificationStats {
  property_id: string;
  channel_status: "not_published" | "published" | "error";
  channel_post_id?: number;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  blocked_count: number;
  last_sent_at?: string;
}

