
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

export type ArenaBattle = {
  id: string;
  title: string;
  creatorId: string;
  creatorName: string;
  participants: string[];
  opponentA: {
    userId: string;
    videoUrl: string;
    votes: number;
  };
  opponentB: {
    userId: string;
    videoUrl: string;
    votes: number;
  };
  participantInfo: Record<string, { name: string; avatarUrl: string; campusAcronym: string; primaryColor: string }>;
  status: 'live' | 'ended';
  votes: Record<string, number>; // Flat map for Cloud Function increments
  viewerCount: number;
  createdAt: any;
  endsAt: any;
};

export type BattleMessage = {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: any;
};

export type CounterAttack = {
  id: string;
  userId: string;
  userName: string;
  videoUrl: string;
  type: 'youtube' | 'tiktok' | 'native';
  createdAt: any;
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
