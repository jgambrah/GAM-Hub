
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
  followedUsers?: string[];
  subscribedCreators?: string[];
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

export type UserDevice = {
  id: string;
  userId: string;
  deviceHash: string;
  lastSeen: any;
  createdAt: any;
};

export type UserBehavior = {
  id: string;
  votesToday: number;
  giftsSent: number;
  watchTime: number; 
  isBlocked: boolean;
  lastUpdated: any;
};

export type FraudLog = {
  id: string;
  type: 'suspicious_votes' | 'multi_account_device' | 'gift_spam' | 'bot_pattern';
  userId: string;
  battleId?: string;
  details: string;
  timestamp: any;
};

export type ContentReport = {
  id: string;
  targetId: string;
  targetType: 'post' | 'battle' | 'comment';
  reportedUserId: string;
  reportedById: string;
  reason: 'harassment' | 'spam' | 'nudity' | 'hate_speech' | 'other';
  details: string;
  status: 'pending' | 'resolved';
  createdAt: any;
};

export type CreatorSettings = {
  id: string;
  subscriptionsEnabled: boolean;
  subscriptionPrice: 2 | 3 | 5;
  subscriberCount: number;
  updatedAt: any;
};

export type CreatorAnalytics = {
  id: string;
  activeSubscribers: number;
  monthlyIncomeGHS: number;
  totalNetEarningsGHS: number;
  newSubscribersLast30: number;
  updatedAt: any;
};

export type CreatorSubscription = {
  id: string;
  creatorId: string;
  subscriberId: string;
  priceMonthly: number;
  status: 'active' | 'cancelled' | 'expired';
  startDate: any;
  renewalDate: any;
};

export type HubWallet = {
  id: string;
  coins: number;
  totalPurchased: number;
  totalSpent: number;
  updatedAt: any;
};

export type WalletTransaction = {
  id: string;
  userId: string;
  type: 'purchase' | 'gift_sent' | 'gift_received' | 'powerup_used' | 'tournament_entry' | 'highlight_boost';
  coins: number;
  amountPaidGHS?: number;
  metadata?: any;
  createdAt: any;
};

export type ArenaTournament = {
  id: string;
  name: string;
  category?: 'weekly' | 'monthly' | 'special';
  entryFeeCoins: number;
  maxPlayers: number;
  currentPlayers: number;
  prizePool: number;
  status: 'registration' | 'ongoing' | 'finished';
  startTime: any;
  createdAt: any;
  platformFeeCollected?: number;
  finalWinners?: {
    first: string;
    second: string;
    third: string;
  };
};

export type ArenaMatch = {
  id: string;
  playerA: string;
  playerB: string;
  playerAName: string;
  playerBName: string;
  playerAAvatar?: string;
  playerBAvatar?: string;
  winner: string | null;
  round: number;
  battleId: string | null;
  status: 'pending' | 'live' | 'completed';
  createdAt?: any;
};

export type ArenaBattle = {
  id: string;
  title: string;
  creatorId: string;
  creatorName: string;
  targetUserId?: string;
  targetUserName?: string;
  participants: string[];
  opponentA: {
    userId: string;
    videoUrl: string;
    votes: number;
    winStreak?: number;
  };
  opponentB: {
    userId: string;
    videoUrl: string;
    votes: number;
    winStreak?: number;
  } | null;
  participantInfo: Record<string, { name: string; avatarUrl: string; campusAcronym: string; primaryColor: string; winStreak?: number }>;
  status: 'waiting' | 'live' | 'ended' | 'under_review';
  votes: Record<string, number>; 
  viewerCount: number;
  aiVerdict?: {
    verdict: string;
    burnLevel: number;
    winner: 'original' | 'comeback' | 'draw';
    refereeAdvice: string;
  };
  isHot?: boolean;
  lastSpikeAt?: any;
  createdAt: any;
  endsAt: any;
  isSponsored?: boolean;
  subscriberOnly?: boolean;
  sponsorId?: string;
  sponsorName?: string;
  sponsorLogo?: string;
  prizeAmount?: number;
  tournamentMatch?: boolean;
  tournamentId?: string;
  matchId?: string;
  round?: number;
  reportCount?: number;
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
  isSponsored?: boolean;
  sponsorName?: string;
  sponsorLogo?: string;
  type?: 'regular' | 'src_official' | 'vetted_announcement' | 'election_winner' | 'shoutout' | 'arena_highlight';
  status?: 'active' | 'blocked' | 'hidden' | 'under_review';
  moderationNote?: string;
  authorColor?: string;
  stats?: { likes: number; burns: number };
  battleMetadata?: {
    battleId: string;
    winnerName: string;
    totalEnergy: number;
    category?: 'savage_roast' | 'funniest_comeback' | 'crowd_favorite' | 'knockout_moment';
    isSponsored?: boolean;
    sponsorName?: string;
  };
  isPromoted?: boolean;
  promotionLevel?: 'none' | 'small' | 'medium' | 'large';
  promotionViewsTarget?: number;
  promotionViewsDelivered?: number;
  reportCount?: number;
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
  isSubscriber?: boolean;
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

export type Notification = {
  id: string;
  type: 
    | 'like' | 'comment' | 'share' | 'follow' | 'voice_reply' 
    | 'message' | 'voice_message' | 'group_message'
    | 'order' | 'price_drop' | 'vendor_reply' | 'product_recommendation'
    | 'event' | 'hostel_update' | 'department_news' | 'war' | 'system' | 'battle_challenge' | 'subscription' | 'moderation_alert';
  title: string;
  message: string;
  link?: string;
  actorId?: string;
  actorName?: string;
  read: boolean;
  createdAt: any;
};

export type ArenaLeaderboard = {
  userId: string;
  name: string;
  avatarUrl: string;
  campusAcronym: string;
  wins: number;
  losses: number;
  winStreak: number;
  bestStreak: number;
  weeklyWins: number;
  votes_received: number;
  highlightCount: number;
  boostsReceived: number;
  giftsReceived: number;
  coinsEarned: number;
  updatedAt: any;
};

export type HallOfFameEntry = {
  id: string;
  campusId: string;
  weekEnding: any;
  totalBurns: number;
};

export type DemandSignal = {
  id: string;
  item: string;
  category: string;
  demandCount: number;
  lastUpdated: any;
};

export type MarketRequest = {
  id: string;
  userId: string;
  userName: string;
  query: string;
  category: string;
  campusId: string;
  location?: string;
  status: 'open' | 'closed';
  createdAt: any;
};

export type MarketProfile = {
  userId: string;
  interests: string[];
  favoriteProducts: string[];
  lastSearch?: string;
};

export type UserIntelligence = {
  interests: Record<string, number>;
  affinities: {
    creators: Record<string, number>;
    vendors: Record<string, number>;
  };
  tasteVector?: number[];
  engagementLevel: number;
  currentStrategy?: string;
  updatedAt: any;
  pricePreference?: {
      min: number;
      max: number;
  };
};

export type MarketplaceSignal = 'view' | 'click' | 'intent' | 'favorite' | 'purchase';
export type VibeSignal = 'watch' | 'like' | 'comment' | 'share' | 'reaction' | 'skip';

export type KnowledgeGraphNode = {
  id: string;
  type: 'tag' | 'creator' | 'vendor' | 'category' | 'location';
  name: string;
  connections: Record<string, { weight: number; lastUpdated: any }>;
  updatedAt: any;
};

export type MarketIntent = {
  category?: string;
  tags?: string[];
  priceMin?: number;
  priceMax?: number;
  intent?: string;
};

export type NotificationSettings = {
  priceDrops: boolean;
  trendingProducts: boolean;
  vendorUpdates: boolean;
  recommendations: boolean;
  quietHours: { start: number; end: number };
};

export type LeadPrice = {
  id: string;
  category: string;
  price: number;
  updatedAt: string;
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
  processedAt?: any;
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

export type SrcPost = {
  id: string;
  title: string;
  content: string;
  campusId: string;
  authorId: string;
  createdAt: any;
};

export type RegistryPost = {
  id: string;
  title: string;
  content: string;
  campusId: string;
  authorId: string;
  isUrgent: boolean;
  targetAudience: 'all' | 'staff' | 'student';
  attachments: string[];
  createdAt: string;
};

export type WatchParty = {
  id: string;
  groupId: string;
  hostId: string;
  videoUrl: string;
  title: string;
  isPlaying: boolean;
  currentTime: number;
  createdAt: any;
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

export type Dispute = {
  id: string;
  orderId: string;
  buyerId: string;
  vendorId: string;
  reason: string;
  evidenceUrls: string[];
  status: 'pending' | 'investigating' | 'resolved_refund' | 'resolved_payout';
  refundNumber: string;
  createdAt: string;
  resolvedAt?: string;
  liaisonNotes?: string;
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

export type CampusLeaderboard = {
  id: string;
  wins: number;
  losses: number;
  totalVotes: number;
  updatedAt: any;
};

export type ArenaWaitingPoolEntry = {
  id: string;
  userId: string;
  userName: string;
  avatarUrl: string;
  campusAcronym: string;
  campusId: string;
  videoUrl: string;
  title: string;
  createdAt: any;
};

export type BattleMessage = {
  id: string;
  userId: string;
  userName: string;
  text: string;
  isSubscriber?: boolean;
  createdAt: any;
};

export type ArenaChallenger = {
  id: string;
  userId: string;
  userName: string;
  avatarUrl: string;
  campusAcronym: string;
  videoUrl: string;
  createdAt: any;
  votes: number;
};

export type VoteShard = {
  votesA: number;
  votesB: number;
};

export type GiftLeaderboardEntry = {
  id: string;
  userName: string;
  avatarUrl: string;
  coinsSent: number;
  updatedAt: any;
};

export type ArenaGiftRecord = {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  giftType: string;
  coinsSpent: number;
  createdAt: any;
};
