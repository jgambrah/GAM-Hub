'use client';

import { usePathname } from 'next/navigation';
import { 
  FlameKindling, Flame, LayoutDashboard, ShoppingBag, Users, Building, Settings, UserCheck, 
  Link, CreditCard, MessagesSquare, ShieldAlert, Landmark, Banknote, Sparkles, MapPin, 
  Globe, BookOpen, PackageCheck, Wallet, History, Zap, Star, Gavel, Key, FileCheck, TrendingUp, Rss,
  Megaphone, ChevronRight, Coins, Plus, Swords
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { NavItem, HubWallet } from '@/lib/types';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar';
import { useCampusView } from '@/hooks/use-campus-view';
import { useView } from '@/context/ViewContext';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['student', 'staff', 'admin', 'src'] },
  { href: '/pulse', label: 'Campus Pulse', icon: Rss, roles: ['student', 'staff', 'admin', 'src'] },
  { href: '/explore', label: 'Explore', icon: Globe, roles: ['student', 'staff', 'admin', 'src'] },
  { href: '/arena', label: 'The Arena', icon: Flame, roles: ['student', 'staff', 'admin', 'src'] },
  { href: '/wallet', label: 'My Wallet', icon: Wallet, roles: ['student', 'staff', 'admin', 'src'] },
  { href: '/registry', label: 'The Registry', icon: Landmark, roles: ['student', 'staff', 'admin', 'src'] },
  { href: '/products', label: 'Products', icon: ShoppingBag, roles: ['student', 'staff', 'admin', 'src'] },
  { href: '/chat', label: 'Chat', icon: MessagesSquare, roles: ['student', 'staff', 'src'] },
  { href: '/connections', label: 'Connections', icon: Link, roles: ['student', 'staff', 'src'] },
  { href: '/groups', label: 'Groups', icon: Users, roles: ['student', 'staff', 'admin', 'src'] },
  { href: '/study', label: 'Study Rooms', icon: BookOpen, roles: ['student', 'staff', 'src'] },
  { href: '/politics', label: 'Politics', icon: Gavel, roles: ['student', 'staff', 'admin', 'src'] },
  { href: '/advertise', label: 'Advertise', icon: Megaphone, roles: ['student', 'staff', 'admin', 'src'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['student', 'staff', 'admin', 'src'] },
];

const adminNavGroups = [
  {
    title: "National Command",
    icon: ShieldAlert,
    items: [
      { href: '/admin/analytics', label: 'Analytics Hub', icon: Globe },
      { href: '/admin/arena', label: 'Arena Command', icon: Swords },
      { href: '/admin/exit-poll', label: 'Exit Polls', icon: TrendingUp },
      { href: '/admin/handover', label: 'Handover Command', icon: Key },
      { href: '/admin/spotlight', label: 'Spotlight Manager', icon: Sparkles },
      { href: '/admin/users', label: 'User Directory', icon: Users },
    ]
  },
  {
    title: "Financial Fortress",
    icon: Banknote,
    items: [
      { href: '/admin/finance', label: 'Finance Center', icon: Banknote },
      { href: '/admin/orders', label: 'Global Orders', icon: CreditCard },
      { href: '/admin/payouts', label: 'Payout Manager', icon: Landmark },
      { href: '/admin/ads', label: 'Ad Review Queue', icon: Megaphone },
      { href: '/admin/campaigns', label: 'Manual Campaigns', icon: Zap },
    ]
  },
  {
    title: "Trust & Vetting",
    icon: UserCheck,
    items: [
      { href: '/admin/id-verification', label: 'ID Vetting', icon: FileCheck },
      { href: '/admin/vendors', label: 'Vendor Approval', icon: UserCheck },
      { href: '/admin/candidates', label: 'Candidate Vetting', icon: Gavel },
      { href: '/admin/disputes', label: 'Dispute Resolution', icon: ShieldAlert },
    ]
  },
  {
    title: "Infrastructure",
    icon: Building,
    items: [
      { href: '/admin/campuses', label: 'Campus Registry', icon: Building },
      { href: '/admin/pickup-points', label: 'Safe Zone Map', icon: MapPin },
    ]
  }
];

const vendorNavItems = [
  {
    group: 'SALES & LOGISTICS',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/vendor/orders', label: 'Order Manager', icon: PackageCheck },
      { href: '/products', label: 'My Products', icon: ShoppingBag },
    ]
  },
  {
    group: 'FINANCIAL HUB',
    items: [
      { href: '/vendor/wallet', label: 'MoMo Wallet', icon: Wallet },
      { href: '/vendor/payouts', label: 'Payout History', icon: History },
    ]
  },
  {
    group: 'MARKETING & GROWTH',
    items: [
      { href: '/vendor/boost', label: 'Major Boost (Ads)', icon: Zap },
      { href: '/vendor/reviews', label: 'Customer Reviews', icon: Star },
    ]
  },
  {
    group: 'COMMUNICATION & SUPPORT',
    items: [
      { href: '/chat', label: 'Messages', icon: MessagesSquare },
      { href: '/vendor/locations', label: 'Safe Zones Map', icon: MapPin },
      { href: '/vendor/settings', label: 'Settings', icon: Settings },
    ]
  }
];

export function AppSidebar() {
  const { user, campus, isAdmin, isUserLoading } = useAuth();
  const { firestore } = useFirebase();
  const { viewMode } = useView();
  const { viewAsCampus } = useCampusView();
  const pathname = usePathname();

  // 💰 LIVE WALLET SYNC
  const walletRef = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    return doc(firestore, 'wallets', user.id);
  }, [firestore, user?.id]);
  const { data: wallet } = useDoc<HubWallet>(walletRef);

  const displayCampus = isAdmin ? (viewAsCampus ?? { acronym: 'GAM', name: 'Global Admin View' }) : campus;

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center justify-between p-2">
            <div className="flex items-center gap-3">
                <FlameKindling className="h-8 w-8 text-sidebar-primary" />
                <div className="flex flex-col">
                    <span className="font-headline text-xl font-semibold leading-tight text-sidebar-primary">{displayCampus?.acronym ?? 'GAM'}</span>
                    <span className="text-[10px] text-sidebar-foreground/70 leading-tight group-data-[collapsible=icon]:hidden uppercase font-black tracking-widest">{displayCampus?.name}</span>
                </div>
            </div>
        </div>
        
        {/* COIN HUD */}
        {!isUserLoading && user && (
            <div className="mx-2 mt-2 p-3 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-xl group-data-[collapsible=icon]:hidden animate-in zoom-in duration-500">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-500 rounded-lg text-slate-950">
                        <Zap size={12} fill="currentColor" />
                    </div>
                    <div>
                        <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Artillery</p>
                        <p className="text-xs font-black tabular-nums">{wallet?.coins || 0} Coins</p>
                    </div>
                </div>
                <a href="/wallet" className="p-1.5 hover:bg-white/10 rounded-lg text-blue-400 transition-all">
                    <Plus size={14} />
                </a>
            </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        {isUserLoading ? (
            <SidebarMenu>
                {[...Array(8)].map((_, i) => (
                    <SidebarMenuItem key={i}>
                        <SidebarMenuSkeleton showIcon />
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        ) : viewMode === 'vendor' ? (
          <SidebarMenu>
            {vendorNavItems.map((group) => (
              <SidebarGroup key={group.group}>
                <SidebarGroupLabel>{group.group}</SidebarGroupLabel>
                <SidebarGroupContent>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                        <a href={item.href}>
                          <item.icon />
                          <span>{item.label}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarMenu>
        ) : viewMode === 'admin' ? (
          <>
            <Collapsible className="group/collapsible" defaultOpen={true}>
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex w-full items-center gap-2 hover:text-foreground">
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="flex-1 text-left">App Experience</span>
                    <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {navItems.filter(item => item.roles.includes('admin')).map(item => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.label}>
                            <a href={item.href}>
                              <item.icon />
                              <span>{item.label}</span>
                            </a>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>

            {adminNavGroups.map((group) => (
              <Collapsible key={group.title} className="group/collapsible" defaultOpen={false}>
                <SidebarGroup>
                  <SidebarGroupLabel asChild>
                    <CollapsibleTrigger className="flex w-full items-center gap-2 hover:text-foreground">
                      <group.icon className="h-4 w-4" />
                      <span className="flex-1 text-left">{group.title}</span>
                      <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {group.items.map((item) => (
                          <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                              <a href={item.href}>
                                <item.icon />
                                <span>{item.label}</span>
                              </a>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            ))}
          </>
        ) : (
          <SidebarMenu>
            {navItems.filter(item => item.roles.includes(viewMode)).map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(item.href) && (item.href !== '/dashboard' || pathname === '/dashboard')}
                  className="justify-start"
                  tooltip={item.label}
                >
                  <a href={item.href}>
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
