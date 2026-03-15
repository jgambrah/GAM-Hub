
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
  balance_available?: number;
  lead_credits?: number; 
  trial_leads_count?: number; 
  rating?: number;
  reviewCount?: number;
  campusAcronym?: string;
  idVerificationStatus?: 'unverified' | 'pending' | 'approved';
  ghanaCardUrl?: string;
  businessName?: string;
  candidatePosition?: string;
  candidacyStatus?: 'none' | 'pending' | 'approved' | 'rejected';
};

export type Notification = {
  id: string;
  type: 
    | 'like' | 'comment' | 'share' | 'follow' | 'voice_reply' 
    | 'message' | 'voice_message' | 'group_message'
    | 'order' | 'price_drop' | 'vendor_reply' | 'product_recommendation'
    | 'event' | 'hostel_update' | 'department_news' | 'system';
  title: string;
  message: string;
  link?: string;
  actorId?: string;
  actorName?: string;
  read: boolean;
  createdAt: any;
};

export type UserIntelligence = {
  id: string;
  interests: Record<string, number>;
  affinities: {
    creators: Record<string, number>;
    vendors: Record<string, number>;
  };
  tasteVector?: number[];
  pricePreference: { min: number; max: number; };
  engagementLevel: number;
  updatedAt: string;
  currentStrategy?: 'A' | 'B' | 'C' | 'D';
};

export type SocialPost = {
  id: string;
  authorId: string;
  authorName?: string;
  authorAvatarUrl?: string;
  campusId: string;
  campusAcronym?: string;
  targetCampus?: string;
  content: string;
  mediaType?: 'youtube' | 'tiktok' | 'image' | 'text' | 'video' | 'audio';
  mediaUrl?: string | null;
  hlsUrl?: string | null;
  imageUrl?: string | null;
  videoHash?: string | null;
  duration?: number; 
  storageTier?: 'hot' | 'warm' | 'cold';
  storagePath?: string | null;
  createdAt: string | any;
  likes: number;
  commentCount: number;
  comebackCount?: number;
  tags?: string[];
  aiTags?: string[]; 
  embedding?: number[]; 
  trendScore?: number; 
  productTags?: string[];
  isArenaEntry?: boolean;
  vibeType?: 'shade' | 'celebration';
  isOfficial?: boolean;
  type?: 'regular' | 'src_official' | 'vetted_announcement' | 'election_winner' | 'shoutout';
  status?: 'active' | 'blocked' | 'hidden';
  moderationNote?: string;
  authorColor?: string;
  stats?: { likes: number; burns: number };
};

export type ArenaPost = SocialPost;

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  imageHint: string;
  videoUrl?: string | null; 
  nativeVideoUrl?: string | null; 
  hlsUrl?: string | null;
  videoHash?: string | null;
  embedding?: number[];
  stock: number;
  vendorId: string;
  vendorName: string;
  campusId: string;
  campusAcronym: string;
  category: string;
  tags?: string[]; 
  salesCount?: number; 
  viewCount?: number; 
  targetAudience: 'all' | 'student' | 'staff';
  isSponsored?: boolean;
  targetType?: 'major' | 'group' | 'all';
  targetValue?: string;
  createdAt?: any;
  productType: 'physical' | 'service';
  interestRate?: string;
  actionLabel?: string;
  averagePrice?: number;
  conversions?: number;
  trendScore?: number;
  rating?: number;
  reviewCount?: number;
  aiReason?: string[];
  adHeadline?: string;
  adSlogan?: string;
  targetGroupId?: string;
};

export type Order = {
  id: string;
  productId: string;
  productName: string;
  buyerId: string;
  buyerName: string;
  buyerType: 'student' | 'staff';
  vendorId: string;
  vendorName?: string;
  campusId: string;
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

export type Chat = {
  id: string;
  users: string[];
  lastMessage: string;
  updatedAt: string;
  userAInfo?: { id: string; name: string; avatarUrl: string; role?: string };
  userBInfo?: { id: string; name: string; avatarUrl: string; role?: string };
  type?: 'private' | 'support' | 'vendor' | 'creator';
};

export type Message = {
  id: string;
  text?: string;
  mediaUrl?: string;
  senderId: string;
  senderName: string;
  type: 'text' | 'image' | 'file' | 'audio' | 'product';
  duration?: number;
  productInfo?: {
      id: string;
      name: string;
      price: number;
      imageUrl: string;
  };
  createdAt: string;
  isForwarded?: boolean;
  readBy?: string[];
  replyTo?: {
    messageId: string;
    text: string;
    senderName: string;
  } | null;
};

export type Group = {
  id: string;
  name: string;
  description?: string;
  campusId: string;
  createdBy: string;
  members: string[];
  admins: string[];
  type: 'class' | 'department' | 'social' | 'staff-only';
  isPrivate: boolean;
  isMainRoom?: boolean;
  createdAt: string;
  lastMessage?: string;
  updatedAt: string;
};

export type StudyRoom = {
  id: string;
  title: string;
  major: string;
  campusId: string;
  content?: string;
  participants: string[];
  authorId: string;
  authorName: string;
  isPrivate: boolean;
  isOfficial?: boolean;
  creatorRole?: string;
  createdAt: any;
  updatedAt: string;
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
};

export type ArenaComeback = {
    id: string;
    text: string;
    authorId: string;
    authorName: string;
    authorCampus: string;
    authorColor: string;
    isCounter: boolean;
    isBot?: boolean;
    mediaUrl?: string;
    mediaType?: 'image' | 'video' | 'youtube' | 'tiktok' | 'audio';
    duration?: number;
    createdAt: any;
};

export type PayoutRequest = {
  id: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  momoNumber: string;
  momoBankCode: string;
  status: 'pending' | 'paid' | 'rejected';
  createdAt: any;
};

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

export type SpotlightItem = {
  id: string;
  title: string;
  type: 'vendor' | 'student' | 'vlog' | 'event' | 'announcement';
  itemId?: string;
  data?: any;
  score?: number;
  isOfficial?: boolean;
  campusId: string;
  authorCampus?: string;
  vibeColor?: string;
  image?: string;
  imageHint?: string;
  content?: string;
  category?: string;
  updatedAt: string;
  sourceType?: 'management' | 'src' | 'department';
};

export type RegistryPost = {
  id: string;
  title: string;
  content: string;
  isUrgent: boolean;
  targetAudience: 'all' | 'staff' | 'student';
  attachments?: string[];
  campusId: string;
  authorId: string;
  createdAt: string;
};

export type LiveBroadcast = {
  id: string;
  status: 'live' | 'off-air';
  videoUrl: string;
  hostName: string;
  hostId: string;
  title: string;
  viewerCount: number;
  currentTime: number;
  updatedAt: any;
};

export type HallOfFameEntry = {
  id: string;
  campusId: string;
  totalBurns: number;
  weekEnding: any;
};

export type MarketIntent = {
  category?: string;
  tags?: string[];
  priceMin?: number;
  priceMax?: number;
  intent?: string;
};

export type KnowledgeGraphNode = {
  id: string;
  type: 'tag' | 'category' | 'vendor' | 'creator' | 'location';
  name: string;
  connections?: Record<string, { weight: number; lastUpdated: any }>;
  updatedAt: any;
};

export type PickupPoint = {
  id: string;
  name: string;
  description: string;
  campusId: string;
  latitude: number;
  longitude: number;
  isOfficial: boolean;
  status: 'active' | 'inactive';
  createdAt: string;
};

export type LeadPrice = {
  id: string;
  category: string;
  price: number;
  updatedAt: string;
};

export type MarketProfile = {
    favoriteProducts: string[];
    followedVendors: string[];
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
    createdAt: string;
};

export type Dispute = {
    id: string;
    orderId: string;
    buyerId: string;
    vendorId: string;
    reason: string;
    evidenceUrls: string[];
    status: 'pending' | 'investigating' | 'resolved_refund' | 'resolved_payout';
    createdAt: string;
    refundNumber?: string;
};

export type Manifesto = {
    id: string;
    candidateName: string;
    candidateImage: string;
    position: string;
    campusId: string;
    campusAcronym: string;
    hall: string;
    motto: string;
    fullManifesto: string;
    campaignVideoUrl?: string;
    endorsements: number;
    status: 'active' | 'archived';
    updatedAt: any;
};

export type SrcPost = {
    id: string;
    title: string;
    content: string;
    mediaUrls?: string[];
    campusId: string;
    authorId: string;
    createdAt: any;
};

export type VibeSignal = 'watch' | 'like' | 'share' | 'comment' | 'skip' | 'reaction';
export type MarketplaceSignal = 'view' | 'click' | 'purchase' | 'favorite' | 'intent';
