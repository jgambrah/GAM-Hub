export interface AdCampaign {
  id:               string;
  advertiserName:   string;
  advertiserLogo:   string;
  headline:         string;
  body?:            string;
  ctaLabel:         string;
  ctaUrl:           string;
  mediaType:        'image' | 'video';
  mediaUrl:         string;
  thumbnailUrl:     string;
  campusIds:        string[];
  targetTags:       string[];
  targetMoods:      string[];
  status:           'active' | 'paused' | 'ended';
  startDate:        any;
  endDate:          any;
  dailyImpressionCap: number;
  perUserDailyCap:    number;
  priority:         number;
  billingModel:     'cpm' | 'cpc';
  rateGHS:          number;
  impressions:      number;
  clicks:           number;
  adType:           'feed_image' | 'feed_video' | 'vibe_slot';
}
