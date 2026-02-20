'use client';

import React from 'react';
import StudentDashboard from '@/components/dashboard/student-dashboard';
import type { User } from '@/lib/types';

export default function StudentMarketplace({ userProfile, showBulletin, showStaffLounge, showVibeFeed }: { userProfile: User, showBulletin?: boolean, showStaffLounge?: boolean, showVibeFeed?: boolean }) {
  return <StudentDashboard showBulletin={showBulletin} showStaffLounge={showStaffLounge} showVibeFeed={showVibeFeed} />;
}
