
export type User = {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'staff' | 'vendor' | 'admin' | 'src' | 'management';
  campusId: string;
  avatarUrl: string;
  isVerified?: boolean; 
  bio?: string;
  major?: string;
  department?: string;
  designation?: string;
  interests?: string[];
  visibility?: 'public' | 'private';
  fcmToken?: string;
  followedVendors?: string[];
  onboardingStatus?: 'needs_submission' | 'pending_review' | 'approved';
  vendorCategory?: string;
  contactPhone?: string;
  momoNumber?: string;
  momoName?: string;
  momoBankCode?: 'MTN' | 'VOD' | 'ATL';
  payoutAccountSetup?: boolean;
  balance_pending?: number;
  balance_available?: number;
  balance_withdrawing?: number;
  total_earned?: number;
  lead_credits?: number; 
  trial_leads_count?: number; 
  rating?: number;
  reviewCount?: number;
  qualityScore?: number; 
  creatorTier?: 'elite' | 'trusted' | 'rising' | 'new'; 
  violationScore?: number; 
  candidacyStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  candidatePosition?: string;
  isAuthority?: boolean;
  installedAt?: any;
  installedBy?: any;
  authorityRole?: 'management' | 'src';
  campusAcronym?: string;
  idVerificationStatus?: 'unverified' | 'pending' | 'approved';
  ghanaCardUrl?: string;
  idSubmittedAt?: any;
  isFullyVerified?: boolean;
  verifiedAt?: any;
  verifiedBy?: string;
  businessName?: string;
};

export type UserIntelligence = {
  id: string;
  interests: Record<string, number>;
  affinities: {
    creators: Record<string, number>;
    vendors: Record<string, number>;
  };
  pricePreference: {
    min: number;
    max: number;
  };
  engagementLevel: number;
  vibeEmbedding?: number[];
  updatedAt: string;
};

export type KnowledgeGraphNode = {
  id: string;
  type: 'tag' | 'category' | 'creator' | 'vendor' | 'location';
  name: string;
  connections: Record<string, { weight: number; lastUpdated: any }>;
  updatedAt: any;
};

export type NotificationSettings = {
  userId: string;
  priceDrops: boolean;
  trendingProducts: boolean;
  vendorUpdates: boolean;
  recommendations: boolean;
  lastSentAt?: string;
  dailyCount?: number;
  quietHours: {
    start: number;
    end: number;
  };
};

export type MarketIntent = {
  category?: string;
  tags?: string[];
  priceMin?: number;
  priceMax?: number;
  intent?: string;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  averagePrice?: number; 
  imageUrl: string;
  imageHint: string;
  videoUrl?: string | null; 
  nativeVideoUrl?: string | null; 
  stock: number;
  vendorId: string;
  vendorName: string;
  campusId: string;
  campusAcronym: string;
  category: string;
  tags?: string[]; 
  salesCount?: number; 
  viewCount?: number; 
  favoriteCount?: number; 
  shareCount?: number; 
  rating?: number; 
  trendScore?: number; 
  recentSales?: number; 
  targetAudience: 'all' | 'student' | 'staff';
  isSponsored?: boolean;
  sponsoredMajor?: string; 
  targetType?: 'major' | 'group' | 'all';
  targetValue?: string;
  targetGroupId?: string; 
  adHeadline?: string; 
  adSlogan?: string; 
  clicks?: number;
  conversions?: number;
  createdAt?: any;
  productType: 'physical' | 'service';
  interestRate?: string;
  actionLabel?: string;
  aiReason?: string[]; 
};

export type SocialPost = {
  id: string;
  authorId: string;
  authorName?: string;
  authorAvatarUrl?: string;
  campusId: string;
  campusAcronym?: string;
  content: string;
  mediaType?: 'youtube' | 'tiktok' | 'image' | 'text' | 'video';
  mediaUrl?: string | null;
  imageUrl?: string | null;
  imageHint?: string;
  createdAt: string;
  likes: number;
  commentCount: number;
  tags?: string[];
  aiTags?: string[]; 
  aiTopics?: string[]; 
  mood?: string; 
  embedding?: number[]; 
  trendScore?: number; 
  authorQualityScore?: number; 
  productTags?: string[];
  commerceClicks?: number; 
};

export type Order = {
  id: string;
  productId: string;
  productName: string;
  buyerId: string;
  buyerName: string;
  buyerType: 'student' | 'staff';
  vendorId: string;
  campusId: string;
  amount: number;
  category: string; 
  status: 'inquiry_sent' | 'awaiting_confirmation' | 'confirmed' | 'paid' | 'picked-up' | 'completed' | 'disputed' | 'refunded' | 'archived';
  deliveryMode: 'pickup_point' | 'office_delivery' | 'service_inquiry';
  deliveryLocation: {
    pointId?: string;
    pointName?: string;
    department?: string;
    roomNumber?: string;
    servicePreference?: 'consultation' | 'visit' | 'digital';
    latitude?: number;
    longitude?: number;
  };
  createdAt: string;
  affiliateCreatorId?: string; 
  commissionRate?: number; 
};

export type Campus = {
  id: string;
  name: string;
  acronym: string;
  location: string;
  studentDomain: string;
  staffDomain: string;
  primaryColor: string;
  secondaryColor: string;
  category: 'Public' | 'Technical' | 'Private';
  latitude?: number;
  longitude?: number;
  radioName?: string;
  radioStreamUrl?: string;
};

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: User['role'][];
};

export type Connection = {
    id: string;
    fromUserId: string;
    toUserId: string;
    fromCampusId: string;
    toCampusId: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: string;
    isInterCampus?: boolean;
}

export type PayoutRequest = {
  id: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  momoNumber: string;
  momoBankCode: string;
  status: 'pending' | 'paid' | 'rejected';
  createdAt: any;
}

export type MarketplaceSignal = 'view' | 'click' | 'purchase' | 'favorite' | 'intent';
export type VibeSignal = 'watch' | 'like' | 'share' | 'comment' | 'skip' | 'reaction';

export type DemandSignal = {
  id: string;
  item: string;
  category: string;
  campusId: string;
  demandCount: number;
  lastUpdated: any;
};

export type MarketRequest = {
  id: string;
  userId: string;
  userName: string;
  query: string;
  category: string;
  tags: string[];
  condition: 'new' | 'used' | 'any';
  campusId: string;
  location: string;
  createdAt: any;
  status: 'open' | 'closed';
};
