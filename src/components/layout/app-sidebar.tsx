'use client';

import { usePathname } from 'next/navigation';
import { FlameKindling, Flame, LayoutDashboard, ShoppingBag, Rss, Users, Building, Settings, UserCheck, Link, CreditCard, MessagesSquare, ShieldAlert, Landmark, Banknote, Sparkles, MapPin, Globe, BookOpen, PackageCheck, Wallet, History, Zap, Star, Gavel, Key, FileCheck } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import type { NavItem } from '@/lib/types';
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

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['student', 'staff', 'admin', 'src'] },
  { href: '/explore', label: 'Explore', icon: Globe, roles: ['student', 'staff', 'admin', 'src'] },
  { href: '/arena', label: 'The Arena', icon: Flame, roles: ['student', 'staff', 'admin', 'src'] },
  { href: '/registry', label: 'The Registry', icon: Landmark, roles: ['student', 'staff', 'admin', 'src'] },
  { href: '/products', label: 'Products', icon: ShoppingBag, roles: ['student', 'staff', 'admin', 'src'] },
  { href: '/chat', label: 'Chat', icon: MessagesSquare, roles: ['student', 'staff', 'src'] },
  { href: '/connections', label: 'Connections', icon: Link, roles: ['student', 'staff', 'src'] },
  { href: '/groups', label: 'Groups', icon: Users, roles: ['student', 'staff', 'admin', 'src'] },
  { href: '/study', label: 'Study Rooms', icon: BookOpen, roles: ['student', 'staff', 'src'] },
  { href: '/politics', label: 'Politics', icon: Gavel, roles: ['student', 'staff', 'admin', 'src'] },
  
  // Admin Section
  { href: '/admin/analytics', label: 'Analytics', icon: Globe, roles: ['admin'] },
  { href: '/admin/handover', label: 'Handover', icon: Key, roles: ['admin'] },
  { href: '/admin/campuses', label: 'Campuses', icon: Building, roles: ['admin'] },
  { href: '/admin/candidates', label: 'Candidates', icon: Gavel, roles: ['admin'] },
  { href: '/admin/id-verification', label: 'ID Verification', icon: FileCheck, roles: ['admin'] },
  { href: '/admin/disputes', label: 'Disputes', icon: ShieldAlert, roles: ['admin'] },
  { href: '/admin/finance', label: 'Finance', icon: Banknote, roles: ['admin'] },
  { href: '/admin/orders', label: 'Orders', icon: CreditCard, roles: ['admin'] },
  { href: '/admin/payouts', label: 'Payouts', icon: Landmark, roles: ['admin'] },
  { href: '/admin/pickup-points', label: 'Pickup Points', icon: MapPin, roles: ['admin'] },
  { href: '/admin/spotlight', label: 'Spotlight', icon: Sparkles, roles: ['admin'] },
  { href: '/admin/users', label: 'Users', icon: Users, roles: ['admin'] },
  { href: '/admin/vendors', label: 'Vendors', icon: UserCheck, roles: ['admin'] },

  { href: '/settings', label: 'Settings', icon: Settings, roles: ['student', 'staff', 'admin', 'src'] },
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
  const { viewMode } = useView();
  const { viewAsCampus } = useCampusView();
  const pathname = usePathname();

  const filteredNavItems = navItems.filter(item => {
    if (!user) return false;
    // For non-vendor roles, filter normally
    if (viewMode !== 'vendor') {
      return item.roles.includes(viewMode);
    }
    return false; // Vendor has a custom menu, don't show main nav items
  });

  // Determine the campus to display based on role and view-as state
  const displayCampus = isAdmin ? (viewAsCampus ?? { acronym: 'GAM', name: 'Global Admin View' }) : campus;

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-3">
            <FlameKindling className="h-8 w-8 text-sidebar-primary" />
            <div className="flex flex-col">
                <span className="font-headline text-xl font-semibold leading-tight text-sidebar-primary">{displayCampus?.acronym ?? 'GAM'}</span>
                <span className="text-xs text-sidebar-foreground/70 leading-tight group-data-[collapsible=icon]:hidden">{displayCampus?.name}</span>
            </div>
        </div>
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
        ) : (
          <SidebarMenu>
            {filteredNavItems.map((item) => (
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
