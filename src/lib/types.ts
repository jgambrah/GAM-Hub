
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
  installedBy?: string;
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

export type MarketProfile = {
  id: string;
  viewedCategories: Record<string, number>;
  purchasedCategories: Record<string, number>;
  intentCategories: Record<string, number>;
  favoriteVendors: Record<string, number>;
  favoriteProducts?: string[]; 
  pricePreference: {
    min: number;
    max: number;
  };
  updatedAt: string;
};

export type MarketIntent = {
  category?: string;
  tags?: string[];
  priceMin?: number;
  priceMax?: number;
  intent?: string;
};

export type ProductTrend = {
  productId: string;
  campusId: string;
  viewCount: number;
  cartCount: number;
  purchaseCount: number;
  shareCount: number;
  lastUpdated: any;
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

export type AdCampaign = {
  id: string;
  advertiserName: string;
  headline: string;
  ctaLabel: string;
  ctaUrl: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  status: 'active' | 'paused' | 'pending_review';
  impressions: number;
  clicks: number;
};

export type Chat = {
  id: string;
  users: [string, string];
  lastMessage?: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  senderId: string;
  senderName: string;
  text?: string;
  type: 'text' | 'image' | 'video' | 'file';
  createdAt: string;
};

export type SpotlightItem = {
  id: string;
  type: 'vendor' | 'student' | 'vlog' | 'announcement';
  title?: string;
  content?: string;
  campusId?: string;
  image?: string | null;
  vibeColor?: string;
  isOfficial?: boolean;
  updatedAt?: string;
};

export type PickupPoint = {
  id: string;
  campusId: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  status: 'active' | 'inactive';
};

export type Group = {
  id: string;
  name: string;
  campusId: string;
  members: string[];
  type: 'social' | 'class' | 'department';
  isPrivate: boolean;
};

export type GroupRequest = {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  status: 'pending' | 'approved' | 'rejected';
};

export type RegistryPost = {
  id: string;
  title: string;
  content: string;
  isUrgent: boolean;
  campusId: string;
  targetAudience: 'all' | 'staff' | 'student';
  attachments?: string[];
  createdAt: string;
};

export type SrcPost = {
  id: string;
  title: string;
  content: string;
  campusId: string;
  authorId: string;
  createdAt: any;
  mediaUrls?: string[];
};

export type LiveBroadcast = {
  id: string;
  status: 'live' | 'off-air';
  videoUrl: string;
  currentTime: number;
  hostName: string;
  title: string;
};

export type StudyRoom = {
  id: string;
  title: string;
  major: string;
  campusId: string;
  content: string;
  authorId: string;
  participants: string[];
  isOfficial?: boolean;
};

export type ArenaPost = {
  id: string;
  authorId: string;
  authorName: string;
  authorCampus: string;
  authorColor: string;
  vibeType: 'shade' | 'celebration';
  content: string;
  stats: {
    likes: number;
    burns: number;
  };
  createdAt: any;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'youtube' | 'tiktok';
};

export type ArenaComeback = {
  id: string;
  text: string;
  authorName: string;
  authorCampus: string;
  authorColor: string;
  isCounter: boolean;
  createdAt: any;
  isBot?: boolean;
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
