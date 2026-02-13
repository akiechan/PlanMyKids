import type { HoursPerDay } from '@/types/database';

export interface ScrapedProviderData {
  name: string;
  description: string;
  category: string[];
  address: string;
  neighborhood: string;
  contact_email: string | null;
  contact_phone: string | null;
  operating_days: string[];
  hours_per_day: HoursPerDay;
  price_min: number | null;
  price_max: number | null;
  price_unit: string | null;
  price_description: string | null;
  registration_url: string | null;
  re_enrollment_date: string | null;
  new_registration_date: string | null;
}
