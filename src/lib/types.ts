
export type User = {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'staff' | 'vendor' | 'admin' | 'src' | 'management';
  campusId: string;
  avatarUrl: string;
  isVerified?: boolean; // for vendors
  bio?: string;
  major?: string;
  department?: string;
  designation?: string;
  interests?: string[];
  visibility?: 'public' | 'private';
  verificationDocUrl?: string;
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
  lead_credits?: number; // CPL balance
  trial_leads_count?: number; // Free trial leads for service providers
  rating?: number;
  reviewCount?: number;
  qualityScore?: number; // Added for Creator Reputation
  fcmToken?: string;
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

export type CreatorReputation = {
  id: string;
  qualityScore: number;
  engagementRate: number;
  completionRate: number;
  postCount: number;
  violationScore: number;
  lastUpdatedAt: any;
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
  radioWebsite?: string;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  imageHint: string;
  videoUrl?: string | null; // YouTube link
  nativeVideoUrl?: string | null; // Storage link
  stock: number;
  vendorId: string;
  vendorName: string;
  campusId: string;
  campusAcronym: string;
  category: string;
  targetAudience: 'all' | 'student' | 'staff';
  isSponsored?: boolean;
  sponsoredMajor?: string; // Kept for backward compatibility
  targetType?: 'major' | 'group' | 'all';
  targetValue?: string;
  targetGroupId?: string; // NEW: Specific targeting ID
  adHeadline?: string; // NEW: The Hook
  adSlogan?: string; // NEW: The Vibe
  adCredits?: number;
  adStatus?: 'active' | 'depleted';
  clicks?: number;
  conversions?: number;
  createdAt?: any;
  productType: 'physical' | 'service';
  interestRate?: string;
  terms?: string;
  actionLabel?: string;
  externalLink?: string;
  has_fuel?: boolean; // Hides service if vendor is out of leads
};

export type AdCampaign = {
  id: string;
  advertiserName: string;
  advertiserLogo?: string;
  submittedByUserId?: string;
  submittedByEmail?: string;
  headline: string;
  body?: string;
  ctaLabel: string;
  ctaUrl: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  thumbnailUrl: string;
  campusIds: string[];
  targetTags: string[];
  targetMoods: string[];
  status: 'active' | 'paused' | 'ended' | 'pending_review' | 'rejected';
  startDate: any;
  endDate: any;
  dailyImpressionCap: number;
  perUserDailyCap: number;
  priority: number;
  billingModel: 'cpm' | 'cpc';
  rateGHS: number;
  totalBudgetGHS?: number;
  totalSpendGHS?: number;
  impressionTarget?: number;
  clickTarget?: number;
  impressions: number;
  clicks: number;
  adType: 'feed_image' | 'feed_video' | 'vibe_slot';
  paystackReference?: string;
  paidAt?: any;
  createdAt: any;
  rejectionReason?: string;
};

export type SocialPost = {
  id: string;
  authorId: string;
  authorName?: string;
  authorAvatarUrl?: string;
  campusId: string;
  campusAcronym?: string;
  content: string;
  title?: string;
  artist?: string; 
  genre?: string;  
  mediaType?: 'youtube' | 'tiktok' | 'image' | 'text' | 'video';
  mediaUrl?: string | null;
  imageUrl?: string | null;
  imageHint?: string;
  createdAt: string;
  likes: number;
  commentCount: number;
  tags?: string[];
  embedding?: number[]; // SEMANTIC VECTOR
  originalVideoPath?: string;
  mediaStatus?: 'processing' | 'ready' | 'error';
  isProtected?: boolean;
  vibeLevel?: string;
  isLiaisonBoosted?: boolean;
  boostedAt?: any;
  type?: 'election_winner' | 'vetted_announcement' | 'regular' | 'src_official';
  winnerName?: string;
  winnerPhoto?: string;
  position?: string;
  isOfficial?: boolean;
};

export type ArenaPost = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string;
  authorCampus: string;
  authorColor: string;
  targetCampus?: string;
  vibeType: 'shade' | 'news' | 'celebration';
  content: string;
  stats: {
    likes: number;
    burns: number;
  };
  createdAt: any;
  comebackCount?: number;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'youtube' | 'tiktok';
  embedding?: number[]; // SEMANTIC VECTOR
  status?: 'active' | 'blocked';
  moderationNote?: string;
};

export type ArenaComeback = {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorCampus: string;
  authorColor: string;
  isCounter: boolean;
  createdAt: any;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'youtube' | 'tiktok';
  isBot?: boolean;
};

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: User['role'][];
  badge?: number;
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
  receivedAt?: string;
  liaisonDecision?: 'refund' | 'payout';
  resolvedAt?: string;
  payoutStatus?: 'pending' | 'paid';
  payoutBatchId?: string;
  momoTransactionId?: string;
  paymentConfirmedAt?: string;
  gatewayResponse?: string;
  productType?: 'physical' | 'service';
};

export type Dispute = {
  id: string;
  orderId: string;
  buyerId: string;
  vendorId: string;
  reason: string;
  evidenceUrls?: string[];
  status: 'pending' | 'investigating' | 'resolved_refund' | 'resolved_payout';
  liaisonNotes?: string;
  createdAt: string;
  refundNumber: string;
};

export type Chat = {
  id: string;
  users: [string, string];
  lastMessage?: string;
  updatedAt: string;
  userAInfo: {
    id: string;
    name: string;
    avatarUrl: string;
  };
  userBInfo: {
    id: string;
    name: string;
    avatarUrl: string;
  };
};

export type Message = {
  id: string;
  senderId: string;
  senderName: string;
  text?: string;
  mediaUrl?: string;
  type: 'text' | 'image' | 'video' | 'file';
  createdAt: string;
  replyTo?: {
    messageId: string;
    text: string;
    senderName: string;
  } | null;
  isForwarded?: boolean;
  reactions?: Record<string, number>;
};

export type SpotlightItem = {
  id: string;
  type: 'vendor' | 'student' | 'vlog' | 'event' | 'announcement';
  title?: string;
  content?: string;
  category?: 'urgent' | 'event' | 'academic' | 'general' | 'finance' | 'security' | 'graduation';
  sourceType?: 'management' | 'src' | 'department';
  targetAudience?: 'all' | 'student' | 'staff';
  itemId?: string;
  campusId?: string;
  authorCampus?: string;
  image?: string | null;
  imageHint?: string;
  attachmentUrl?: string;
  vibeColor?: string;
  isOfficial?: boolean;
  isUrgent?: boolean;
  manualOverride?: boolean;
  mediaUrl?: string | null;
  mediaType?: 'youtube' | 'tiktok' | 'image' | 'text' | 'video';
  authorId?: string;
  authorName?: string;
  score?: number;
  data?: User | SocialPost;
  updatedAt?: string;
};

export type PickupPoint = {
  id: string;
  campusId: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  isOfficial: boolean;
  status: 'active' | 'inactive';
  createdAt: string;
};

export type Group = {
  id: string;
  name: string;
  description: string;
  campusId: string;
  createdBy: string;
  members: string[];
  admins: string[];
  type: 'class' | 'department' | 'social' | 'staff-only';
  isPrivate: boolean;
  createdAt: string;
  isMainRoom?: boolean;
};
    
export type GroupRequest = {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  userCampusId: string;
  userAvatarUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt?: any;
};

export type Review = {
  id: string;
  orderId: string;
  vendorId: string;
  buyerId: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type SearchTrend = {
  id: string;
  keyword: string;
  count: number;
  campusId: string;
  lastSearched: any;
};

export type PayoutRequest = {
  id: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  momoNumber: string;
  momoBankCode: 'MTN' | 'VOD' | 'ATL';
  status: 'pending' | 'processing' | 'paid' | 'rejected';
  createdAt: any;
  processedAt?: any;
  rejectionReason?: string;
};
    
export type Manifesto = {
  id: string;
  candidateName: string;
  position: string;
  campusId: string;
  campusAcronym: string;
  hall?: string;
  motto?: string;
  fullManifesto: string;
  campaignVideoUrl?: string;
  status: 'pending' | 'active' | 'archived';
  endorsements: number;
  candidateImage?: string;
  updatedAt?: any;
};

export type CandidateApplication = {
  id: string;
  userId: string;
  name: string;
  position: string;
  campusId: string;
  hall: string;
  studentIdCardUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  vettedBy?: string;
  vettedAt?: any;
};

export type WatchParty = {
  id: string;
  hostId: string;
  groupId: string;
  videoUrl: string;
  isPlaying: boolean;
  currentTime: number;
  title: string;
  updatedAt: string;
};

export type LiveBroadcast = {
  id: string;
  status: 'live' | 'off-air';
  videoUrl: string;
  currentTime: number;
  hostId: string;
  hostName: string;
  title: string;
  viewerCount: number;
  updatedAt: string;
};

export type HallOfFameEntry = {
  id: string;
  campusId: string;
  totalBurns?: number;
  totalPoints?: number;
  weekEnding?: any;
  monthEnding?: any;
  type: "arena_vibe_king" | "yard_strength_champion";
};

export type StudyRoom = {
  id: string;
  title: string;
  topic?: string;
  major: string;
  campusId: string;
  content: string;
  authorId: string;
  authorName?: string;
  participants: string[];
  createdAt: any;
  updatedAt: string;
  isPrivate?: boolean;
  isOfficial?: boolean;
  creatorRole?: string;
};

export type TrendEvent = {
    id: string;
    tags: string[];
    collectiveVelocity: number;
    detectedAt: any;
    status: 'active' | 'archived';
};
