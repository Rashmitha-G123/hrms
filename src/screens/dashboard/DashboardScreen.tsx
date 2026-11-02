import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Animated, Platform, StatusBar, Dimensions,
  Alert, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { checkInApi, checkOutApi, fetchTodayStatus, fetchIpLocation, CheckLocationPayload } from '../../services/attendanceService';
import Svg, { Circle } from 'react-native-svg';
import { fetchProfile } from '../../services/authService';
import { fetchTasks, pauseAllTimersApi } from '../../services/taskService';
import { fetchAnnouncements } from '../../services/announcementService';
import { fetchRecentNotificationsApi, markNotificationReadApi, markAllNotificationsReadApi } from '../../services/notificationService';
import { Colors, Typography, Spacing, Radius, Shadow, IconBox } from '../../design-system/tokens';
import { Avatar } from '../../design-system/components/Avatar';
import { Badge, statusToVariant } from '../../design-system/components/Badge';
import { ProgressBar } from '../../design-system/components/Card';
// import { mockAttendance } from '../../data/mockData';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 16 * 2 - 10) / 2;

const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const QUICK_ACTIONS = [
  { icon: 'person-add-outline' as const, label: 'Leads', color: '#34D399', route: '/leads/add' },
  { icon: 'megaphone-outline' as const, label: 'Announcements', color: '#FF4D6D', route: '/announcements' },
  { icon: 'person-outline' as const, label: 'Profile', color: '#2E86B5', route: '/profile' },
];

const STATS = (pendingTasks: number, activeProjects: number, leaveBalance: number, attendance: string) => [
  { label: 'Active Tasks', value: pendingTasks, icon: 'list-outline' as const, color: '#428DFF', bgColor: '#E9F2FF', route: '/(tabs)/tasks' },
  { label: 'Pending Tasks', value: activeProjects, icon: 'timer-outline' as const, color: '#FFA05D', bgColor: '#FFF0E5', route: '/(tabs)/tasks' },
  { label: 'Leave Balance', value: leaveBalance, icon: 'calendar-outline' as const, color: '#10C185', bgColor: '#E5F8F2', route: '/(tabs)/leaves' },
  { label: 'Attendance', value: attendance, icon: 'checkmark-circle-outline' as const, color: '#FF2056', bgColor: '#FFE9EE', route: '/(tabs)/attendance' },
];

function useElapsedTimer(checkedIn: boolean, inTimeStr?: string | null, outTimeStr?: string | null) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!inTimeStr || inTimeStr === '--:--') {
      setElapsed(0);
      return;
    }

    const calculateElapsed = () => {
      try {
        const getSecondsSinceMidnight = (timeStr: string) => {
          const cleanedTime = timeStr.replace(/\s*[A-Z]{2}$/i, '').trim(); // Strip AM/PM
          const isPM = /\s*PM$/i.test(timeStr);
          const isAM = /\s*AM$/i.test(timeStr);
          let [hours, minutes] = cleanedTime.split(':').map(Number);
          if (isPM && hours < 12) hours += 12;
          if (isAM && hours === 12) hours = 0;
          return hours * 3600 + minutes * 60;
        };

        const inSeconds = getSecondsSinceMidnight(inTimeStr);
        let outSeconds = 0;
        if (outTimeStr && outTimeStr !== 'Pending' && outTimeStr !== '--:--') {
          outSeconds = getSecondsSinceMidnight(outTimeStr);
        } else {
          const now = new Date();
          outSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        }

        let diffSeconds = outSeconds - inSeconds;
        if (diffSeconds < 0) {
          diffSeconds += 24 * 3600; // handle midnight crossing
        }
        setElapsed(diffSeconds);
      } catch (err) {
        setElapsed(0);
      }
    };

    calculateElapsed();
    if (checkedIn) {
      const id = setInterval(calculateElapsed, 1000);
      return () => clearInterval(id);
    }
  }, [checkedIn, inTimeStr, outTimeStr]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const isNotificationRead = (n: any, currentUserId?: string) => {
  const readList = n.readBy || n.readUsers || n.read_by || n.read || [];
  const isReadArray = Array.isArray(readList) && (n.readBy || n.readUsers || n.read_by || Array.isArray(n.read));

  if (!currentUserId) {
    if (isReadArray) return false;
    return !!n.read || !!n.isRead;
  }
  
  // Sometimes APIs return a direct boolean if they pre-computed it
  if (n.isRead === true || n.read === true) return true;
  
  if (Array.isArray(readList) && readList.length > 0) {
    return readList.some((u: any) => {
      let targetId = u;
      if (typeof u === 'object' && u !== null) {
        if (u.user && typeof u.user === 'object') {
          targetId = u.user._id || u.user.id;
        } else if (u.userId && typeof u.userId === 'object') {
          targetId = u.userId._id || u.userId.id;
        } else {
          targetId = u.user || u.userId || u._id || u.id;
        }
      }
      return targetId?.toString() === currentUserId?.toString();
    });
  }
  return false;
};

const formatTimeDisplay = (timeStr: string | null) => {
  if (!timeStr) return '--:--';
  if (timeStr.includes('AM') || timeStr.includes('PM') || timeStr.includes('am') || timeStr.includes('pm')) {
    return timeStr;
  }
  try {
    const parts = timeStr.split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
  } catch (err) {
    return timeStr;
  }
};

async function detectLocationWithFallback(): Promise<{ location: string; latitude?: number; longitude?: number; locationSource: 'gps' | 'ip' | 'manual' }> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      fetchIpLocation()
        .then(ipLoc => {
          if (ipLoc && ipLoc.location) {
            resolve({
              location: ipLoc.location.address,
              latitude: ipLoc.location.latitude,
              longitude: ipLoc.location.longitude,
              locationSource: 'ip'
            });
          } else {
            resolve({ location: 'Home Office', locationSource: 'manual' });
          }
        })
        .catch(() => {
          resolve({ location: 'Home Office', locationSource: 'manual' });
        });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`, {
            headers: {
              'User-Agent': 'HRMSMobileApp/1.0'
            }
          });
          if (res.ok) {
            const data = await res.json();
            const address = data.display_name || data.address?.city || data.address?.town || data.address?.suburb || 'Office';
            const shortAddress = address.split(',').slice(0, 3).join(',').trim();
            resolve({
              location: shortAddress || `Coords: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
              latitude,
              longitude,
              locationSource: 'gps'
            });
          } else {
            resolve({
              location: `Coords: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
              latitude,
              longitude,
              locationSource: 'gps'
            });
          }
        } catch (err) {
          resolve({
            location: `Coords: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            locationSource: 'gps'
          });
        }
      },
      async (error) => {
        console.warn('Geolocation error, falling back to IP location:', error);
        try {
          const ipLoc = await fetchIpLocation();
          if (ipLoc && ipLoc.location) {
            resolve({
              location: ipLoc.location.address,
              latitude: ipLoc.location.latitude,
              longitude: ipLoc.location.longitude,
              locationSource: 'ip'
            });
          } else {
            resolve({ location: 'Home Office', locationSource: 'manual' });
          }
        } catch (err) {
          resolve({ location: 'Home Office', locationSource: 'manual' });
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  });
}

export default function DashboardScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState('--:--');
  const [checkOutTime, setCheckOutTime] = useState('--:--');
  const [actionLoading, setActionLoading] = useState(false);

  const [profile, setProfile] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [apiUnreadCount, setApiUnreadCount] = useState<number | null>(null);
  const [detectedLocation, setDetectedLocation] = useState('Detecting location...');
  const [detectedLocObj, setDetectedLocObj] = useState<CheckLocationPayload | null>(null);

  const loadTodayStatus = React.useCallback(async () => {
    try {
      const data = await fetchTodayStatus();
      if (data && data.success && data.attendance) {
        const inTime = data.attendance.inTime;
        const outTime = data.attendance.outTime;

        if (inTime) {
          setCheckInTime(formatTimeDisplay(inTime));
          setCheckedIn(!outTime);
        } else {
          setCheckInTime('--:--');
          setCheckedIn(false);
        }

        if (outTime) {
          setCheckOutTime(formatTimeDisplay(outTime));
        } else if (inTime) {
          setCheckOutTime('Pending');
        } else {
          setCheckOutTime('--:--');
        }
      } else {
        setCheckInTime('--:--');
        setCheckOutTime('--:--');
        setCheckedIn(false);
      }
    } catch (err) {
      console.warn('Failed to fetch today status from API:', err);
    }
  }, []);

  const loadDashboardData = async () => {
    await loadTodayStatus();

    try {
      setDetectedLocation('Detecting location...');
      const locRes = await detectLocationWithFallback();
      setDetectedLocation(locRes.location);
      setDetectedLocObj(locRes);
    } catch (e) {
      setDetectedLocation('Home Office');
      setDetectedLocObj({ location: 'Home Office', locationSource: 'manual' });
    }

    try {
      const pData = await fetchProfile();
      if (pData && pData.user) {
        setProfile(pData.user);
      } else if (pData) {
        setProfile(pData);
      }
    } catch (e) {
      console.warn('Dashboard failed to load profile:', e);
    }

    try {
      const tData = await fetchTasks();
      if (tData && Array.isArray(tData.items)) {
        setTasks(tData.items);
      } else if (tData && Array.isArray((tData as any).tasks)) {
        setTasks((tData as any).tasks);
      }
    } catch (e) {
      console.warn('Dashboard failed to load tasks:', e);
    }

    try {
      const aData = await fetchAnnouncements();
      if (aData && Array.isArray(aData.data)) {
        setAnnouncements(aData.data);
      } else if (Array.isArray(aData)) {
        setAnnouncements(aData);
      }
    } catch (e) {
      console.warn('Dashboard failed to load announcements:', e);
    }

    try {
      const nData = await fetchRecentNotificationsApi();
      
      if (nData && typeof nData.unreadCount === 'number') {
        setApiUnreadCount(nData.unreadCount);
      } else {
        setApiUnreadCount(null);
      }

      if (nData && Array.isArray(nData.notifications)) {
        setNotifications(nData.notifications);
      } else if (nData && Array.isArray(nData.data)) {
        setNotifications(nData.data);
      } else if (Array.isArray(nData)) {
        setNotifications(nData);
      }
    } catch (e) {
      console.warn('Dashboard failed to load notifications:', e);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadDashboardData();
    }, [loadTodayStatus])
  );

  const handleToggleCheck = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      let ipLoc = null;
      try {
        ipLoc = await fetchIpLocation();
      } catch (err) {
        console.warn('Failed to fetch IP location API:', err);
      }

      let payload: CheckLocationPayload = {
        location: 'Home Office',
        locationSource: 'manual'
      };

      if (ipLoc && ipLoc.success && ipLoc.location) {
        payload = {
          location: ipLoc.location.address,
          latitude: ipLoc.location.latitude,
          longitude: ipLoc.location.longitude,
          locationSource: (ipLoc.location.source as any) || 'ip'
        };
      }

      if (detectedLocObj && detectedLocObj.locationSource === 'gps') {
        payload = {
          location: detectedLocObj.location,
          latitude: detectedLocObj.latitude,
          longitude: detectedLocObj.longitude,
          locationSource: 'gps'
        };
      }

      if (checkedIn) {
        try {
          await pauseAllTimersApi();
        } catch (timerErr) {
          console.warn('Failed to pause all timers on check-out:', timerErr);
        }
        const res = await checkOutApi(payload);
        if (res.success) {
          Alert.alert('Success', `Checked out successfully from ${payload.location}.`);
          await loadTodayStatus();
        }
      } else {
        const res = await checkInApi(payload);
        if (res.success) {
          Alert.alert('Success', `Checked in successfully from ${payload.location}.`);
          await loadTodayStatus();
        }
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.message || 'Failed to update attendance');
    } finally {
      setActionLoading(false);
    }
  };

  const elapsedTime = useElapsedTimer(checkedIn, checkInTime, checkOutTime);
  const [elapsedH, elapsedM, elapsedS] = elapsedTime.split(':').map(Number);
  const elapsedSeconds = elapsedH * 3600 + elapsedM * 60 + elapsedS;
  const totalShiftSeconds = 9 * 3600;
  const isShiftCompleted = !checkedIn && !!checkInTime && checkInTime !== '--:--' && checkOutTime !== '--:--' && checkOutTime !== 'Pending';
  const progressPercent = (checkedIn || isShiftCompleted) ? (elapsedSeconds / totalShiftSeconds) : 0;
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(progressPercent, 1) * circumference);
  const scrollViewRef = useRef<ScrollView>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const currentUserId = profile?._id || profile?.id;
  const unreadCount = apiUnreadCount !== null ? apiUnreadCount : notifications.filter(n => !isNotificationRead(n, currentUserId)).length;
  const activeTasksCount = tasks.filter(t => t.status === 'in-progress' || t.status === 'in_progress' || t.status === 'todo').length;
  const pendingTasksCount = tasks.filter(t => t.status === 'paused' || t.status === 'in_progress').length;
  const leaveBalance = profile?.leaveBalance?.remaining
    ? (profile.leaveBalance.remaining.annual || 0) + (profile.leaveBalance.remaining.sick || 0) + (profile.leaveBalance.remaining.casual || 0)
    : 8;
  const stats = STATS(activeTasksCount, pendingTasksCount, leaveBalance, '96%');

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsReadApi();
      setApiUnreadCount(0);
      setNotifications(prev => prev.map(n => {
        if (Array.isArray(n.readBy)) return { ...n, readBy: [...n.readBy, currentUserId] };
        if (Array.isArray(n.read)) return { ...n, read: [...n.read, { user: currentUserId }] };
        return { ...n, read: true, isRead: true };
      }));
    } catch (err: any) {
      console.warn('Failed to mark all as read:', err);
    }
  };

  const handleToggleRead = async (id: string) => {
    try {
      await markNotificationReadApi(id);
      
      const notif = notifications.find(n => (n.id || n._id) === id);
      if (notif && !isNotificationRead(notif, currentUserId)) {
         setApiUnreadCount(prev => (prev !== null && prev > 0) ? prev - 1 : prev);
      }

      setNotifications(prev => prev.map(n => {
        if ((n.id || n._id) === id) {
          if (Array.isArray(n.readBy)) return { ...n, readBy: [...n.readBy, currentUserId] };
          if (Array.isArray(n.read)) return { ...n, read: [...n.read, { user: currentUserId }] };
          return { ...n, read: true, isRead: true };
        }
        return n;
      }));
    } catch (err: any) {
      console.warn('Failed to toggle read:', err);
    }
  };

  const name = profile?.name || 'Venil Mottana';
  const firstName = name.split(' ')[0];
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const designation = profile?.employmentDetails?.designation?.name || profile?.designation || 'Senior Software Engineer';

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Header ── */}
      <LinearGradient colors={['#2b7eff', '#2b7eff', '#2b7eff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.header}>
        {/* decorative circles */}
        <View style={s.hCircle1} />
        <View style={s.hCircle2} />
        <View style={s.hRow}>
          <View style={s.hLeft}>
            <Text style={s.hGreeting}>{getGreeting()} 👋</Text>
            <Text style={s.hName}>{firstName}</Text>
            <Text style={s.hRole}>{designation}</Text>
          </View>
          <View style={s.hRight}>
            <TouchableOpacity style={s.notifBtn} onPress={() => router.push('/notifications')}>
              <Ionicons name="notifications-outline" size={22} color="#fff" />
              {unreadCount > 0 && (
                <View style={s.notifDot}><Text style={s.notifDotTxt}>{unreadCount}</Text></View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/profile')} style={s.avatarWrap}>
              <Avatar name={name} initials={initials} size={42} />
              <View style={s.avatarOnline} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Attendance strip inside header */}
        {/* <View style={s.attStrip}>
          <View style={s.attSlot}>
            <Ionicons name="log-in-outline" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={s.attSlotLabel}>CHECK IN</Text>
            <Text style={s.attSlotVal}>{today.checkIn}</Text>
          </View>
          <View style={s.attDivider} />
          <View style={s.attSlot}>
            <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={s.attSlotLabel}>WORKING</Text>
            <Text style={s.attSlotVal}>{elapsedTime.slice(0, 5)}</Text>
          </View>
          <View style={s.attDivider} />
          <View style={s.attSlot}>
            <Ionicons name="log-out-outline" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={s.attSlotLabel}>CHECK OUT</Text>
            <Text style={[s.attSlotVal, { color: '#FCD34D' }]}>{checkOutTime}</Text>
          </View>
        </View> */}
      </LinearGradient>

      {/* ── Body ── */}
      <ScrollView
        ref={scrollViewRef as any}
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >

        {/* Stats Grid (Existing) */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>Overview</Text>
          {/* <TouchableOpacity><Text style={s.seeAll}>See All</Text></TouchableOpacity> */}
        </View>
        <View style={s.statsGrid}>
          {stats.map((item, i) => (
            <TouchableOpacity key={i} style={[s.statCard, { width: CARD_W }]} onPress={() => router.push(item.route as any)} activeOpacity={0.82}>
              <View style={[s.statIconBox, { backgroundColor: item.bgColor }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              {/* <Text style={s.statValue}>{item.value}</Text>
              <Text style={s.statLabel} numberOfLines={1}>{item.label}</Text> */}
              <View style={{ flex: 1 }}>
                <Text style={s.statLabel}>{item.label}</Text>
                <Text style={s.statValue}>{item.value}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Actions (Existing) */}
        <View style={s.quickActionsCard}>
          <View style={s.cardTitleRow}>
            <View style={s.cardTitleLeft}>
              <View style={[s.cardIconCircle, { backgroundColor: '#E8F4FF' }]}>
                <Ionicons name="flash-outline" size={18} color="#2563EB" />
              </View>
              <View>
                <Text style={s.cardTitle}>Quick Actions</Text>
                <Text style={s.cardSubtitle}>Frequently used shortcuts</Text>
              </View>
            </View>
          </View>

          <View style={s.quickActionsGrid}>
            {QUICK_ACTIONS.map((a, i) => (
              <TouchableOpacity
                key={i}
                style={s.quickActionItem}
                onPress={() => router.push(a.route as any)}
                activeOpacity={0.8}
              >
                <View style={[s.quickActionIcon, { backgroundColor: `${a.color}15` }]}>
                  <Ionicons name={a.icon} size={22} color={a.color} />
                </View>
                <Text style={s.quickActionText}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── CARD 2: UPGRADED ATTENDANCE CARD WITH RADIAL TIMER & BUTTON ── */}
        {profile?.role !== 'admin' && profile?.role !== 'superadmin' && (
          <View style={s.attendanceCard}>
            {/* <View style={s.cardTitleRow}>
              <View style={s.cardTitleLeft}>
                <View style={[s.cardIconCircle, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="cafe-outline" size={18} color="#D97706" />
                </View>
                <View>
                  <Text style={s.cardTitle}>Attendance</Text>
                  <Text style={s.cardSubtitle}>THURSDAY, JUN 25</Text>
                </View>
              </View>
            </View> */}

            <View style={s.radialContainer}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleToggleCheck}
                style={s.radialOutline}
              >
                {/* SVG Ring Progress */}
                <Svg width={155} height={155} style={s.svgRing}>
                  {/* Background Circle */}
                  <Circle
                    cx={77.5}
                    cy={77.5}
                    r={radius}
                    stroke={(checkedIn || isShiftCompleted) ? '#D1FAE5' : '#E2E8F0'}
                    strokeWidth={6}
                    fill="none"
                  />
                  {/* Foreground Progress Circle */}
                  {(checkedIn || isShiftCompleted) && (
                    <Circle
                      cx={77.5}
                      cy={77.5}
                      r={radius}
                      stroke="#10B981"
                      strokeWidth={6}
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="none"
                      transform="rotate(-90 77.5 77.5)"
                    />
                  )}
                </Svg>

                <View style={s.radialInner}>
                  <View style={s.radialTopRow}>
                    <Ionicons name="time-outline" size={13} color={(checkedIn || isShiftCompleted) ? '#10B981' : '#8E9AA8'} />
                    <Text style={s.radialLabel}>{(checkedIn || isShiftCompleted) ? 'ELAPSED' : 'READY'}</Text>
                  </View>
                  <Text style={[s.radialTime, (checkedIn || isShiftCompleted) && s.radialTimeActive]}>
                    {(checkedIn || isShiftCompleted) ? elapsedTime.slice(0, 5) : '00:00'}
                  </Text>
                  <Text style={s.radialSeconds}>
                    {(checkedIn || isShiftCompleted) ? `${elapsedTime.slice(6, 8)}s` : '00s'}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={[s.radialBadge, (!checkedIn && !isShiftCompleted) && s.radialBadgeInactive, isShiftCompleted && { backgroundColor: '#D1FAE5' }]}>
                <Text style={(checkedIn || isShiftCompleted) ? s.radialBadgeText : s.radialBadgeTextInactive}>
                  {checkedIn ? 'CURRENTLY' : isShiftCompleted ? 'SHIFT' : 'READY TO'}
                </Text>
                <Text style={(checkedIn || isShiftCompleted) ? s.radialBadgeText : s.radialBadgeTextInactive}>
                  {checkedIn ? 'WORKING' : isShiftCompleted ? 'COMPLETED' : 'START'}
                </Text>
              </View>
            </View>

            <View style={s.attGrid}>
              <View style={s.attBox}>
                <Text style={s.attLabel}>CHECK IN</Text>
                <Text style={s.attValue}>{checkInTime}</Text>
              </View>
              <View style={s.attBox}>
                <Text style={s.attLabel}>CHECK OUT</Text>
                <Text style={s.attValue}>{checkOutTime}</Text>
              </View>
            </View>

            <View style={s.locRow}>
              <Ionicons name="location-outline" size={14} color="#D97706" />
              <Text style={s.locText}>{detectedLocation} • Auto-detected</Text>
            </View>

            {/* Explicit Check In / Check Out Button */}
            <View style={s.buttonContainer}>
              <TouchableOpacity
                style={[
                  s.attCardBtn,
                  { backgroundColor: checkedIn ? '#F87171' : isShiftCompleted ? '#9CA3AF' : '#34D399' }
                ]}
                onPress={handleToggleCheck}
                activeOpacity={isShiftCompleted ? 1 : 0.85}
                disabled={isShiftCompleted || actionLoading}
              >
                <Ionicons name={checkedIn ? 'log-out-outline' : isShiftCompleted ? 'checkmark-circle-outline' : 'log-in-outline'} size={16} color="#fff" />
                <Text style={s.attCardBtnTxt}>
                  {checkedIn ? 'Check Out' : isShiftCompleted ? `Shift Completed • ${elapsedH}h ${elapsedM}m` : 'Check In'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Existing Week row nested within attendance card */}
            {/* <Text style={s.attCardWeekTitle}>This Week</Text>
            <View style={s.attCardWeekRow}>
              {WEEK_DAYS.map((day, i) => {
                const status = i === 0 ? 'active' : i === 5 || i === 6 ? 'weekend' : i === 4 ? 'absent' : 'present';
                const color = status === 'present' ? '#34D399' : status === 'active' ? '#4DA8DA' : status === 'absent' ? '#F87171' : '#D1D5DB';
                return (
                  <View key={i} style={s.attCardDay}>
                    <Text style={s.attCardDayLabel}>{day}</Text>
                    <View style={[s.attCardDayDot, { backgroundColor: color }]}>
                      {status === 'active' && <View style={s.attCardDayPulse} />}
                    </View>
                  </View>
                );
              })}
            </View>
            <View style={s.attCardLegend}>
              {([['Present', '#34D399'], ['Active', '#4DA8DA'], ['Absent', '#F87171'], ['Weekend', '#D1D5DB']] as [string, string][]).map(([label, color]) => (
                <View key={label} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: color }]} />
                  <Text style={s.legendTxt}>{label}</Text>
                </View>
              ))}
            </View> */}
          </View>
        )}

        {/* ── CARD 3: RECENT NOTIFICATIONS CARD ── */}
        <View style={s.notificationsCard}>
          <View style={s.cardTitleRow}>
            <View style={s.cardTitleLeft}>
              <View style={[s.cardIconCircle, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="notifications" size={18} color="#2563EB" />
                {unreadCount > 0 && <View style={s.cardBellBadge} />}
              </View>
              <View>
                <Text style={s.cardTitle}>Recent Activity</Text>
                <Text style={s.cardSubtitle}>{unreadCount} unread messages</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => router.push('/notifications')} style={s.cardHeaderAction} activeOpacity={0.7}>
              <Ionicons name="chevron-forward-outline" size={20} color={Colors.gray500} />
            </TouchableOpacity>
          </View>

          <View style={s.notifList}>
            {notifications.filter(item => !isNotificationRead(item, currentUserId)).length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="notifications-off-outline" size={24} color={Colors.gray300} style={{ marginBottom: 4 }} />
                <Text style={{ color: Colors.gray400, fontSize: 12, fontWeight: '500' }}>No unread notifications</Text>
              </View>
            ) : (
              notifications.filter(item => !isNotificationRead(item, currentUserId)).slice(0, 3).map((item) => (
                <View key={item._id || item.id} style={[s.notifItem, !isNotificationRead(item, currentUserId) && s.notifItemUnread]}>
                  {!isNotificationRead(item, currentUserId) && <View style={s.unreadBar} />}
                  <View style={s.notifIconCircle}>
                    <Ionicons
                      name={item.type === 'announcement' ? 'megaphone-outline' : 'person-outline'}
                      size={14}
                      color={isNotificationRead(item, currentUserId) ? Colors.gray500 : '#2563EB'}
                    />
                  </View>
                  <View style={s.notifContent}>
                    <Text style={s.notifTitle}>{item.title}</Text>
                    <Text style={s.notifDesc} numberOfLines={2}>{item.message}</Text>
                    <View style={s.notifDateRow}>
                      <Ionicons name="time-outline" size={10} color={Colors.gray400} />
                      <Text style={s.notifDate}>{item.time || (item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '')}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => handleToggleRead(item.id || item._id)} style={s.notifCheck}>
                    <Ionicons
                      name={isNotificationRead(item, currentUserId) ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={isNotificationRead(item, currentUserId) ? '#34D399' : Colors.gray300}
                    />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>

        {/* ── CARD 4: RECENT ANNOUNCEMENTS CARD ── */}
        <View style={s.announcementsCard}>
          <View style={s.cardTitleRow}>
            <View style={s.cardTitleLeft}>
              <View style={[s.cardIconCircle, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="megaphone" size={18} color="#EF4444" />
              </View>
              <View>
                <Text style={s.cardTitle}>Announcements</Text>
                <Text style={s.cardSubtitle}>Latest updates from teams</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => router.push('/announcements')} style={s.cardHeaderAction} activeOpacity={0.7}>
              <Ionicons name="chevron-forward-outline" size={20} color={Colors.gray500} />
            </TouchableOpacity>
          </View>

          <View style={s.annList}>
            {announcements.slice(0, 3).map((item: any) => {
              const priority = item.priority || 'Medium';
              const priorityColor = priority === 'Urgent' ? '#EF4444' : priority === 'High' ? '#3B82F6' : priority === 'Medium' ? '#F59E0B' : '#10B981';
              const priorityBg = priority === 'Urgent' ? '#FFE4EA' : priority === 'High' ? '#DBEAFE' : priority === 'Medium' ? '#FEF3C7' : '#D1FAE5';
              const category = item.category || 'General';
              const contentText = item.description ? item.description.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'") : 'Announcement details...';
              const formattedDate = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '';
              return (
                <TouchableOpacity
                  key={item._id || item.id}
                  style={item.pinned ? [s.annItem, { backgroundColor: '#FFFDF5' }] : s.annItem}
                  onPress={() => router.push('/announcements')}
                  activeOpacity={0.8}
                >
                  {/* Left colored bar based on priority */}
                  <View style={[s.annPriorityBar, { backgroundColor: priorityColor }]} />

                  <View style={s.annIconCircle}>
                    <Ionicons
                      name={item.category === 'Holiday' ? 'calendar-outline' : item.category === 'Policy' ? 'document-text-outline' : 'megaphone-outline'}
                      size={14}
                      color={priorityColor}
                    />
                  </View>
                  <View style={s.annContent}>
                    <View style={s.annMetaRow}>
                      <View style={[s.annPriorityBadge, { backgroundColor: priorityBg }]}>
                        <Text style={[s.annPriorityText, { color: priorityColor }]}>{item.priority}</Text>
                      </View>
                      <Text style={s.annCategoryText}>{item.category}</Text>
                      {item.pinned && (
                        <Ionicons name="pin" size={10} color="#F59E0B" style={{ marginLeft: 'auto' }} />
                      )}
                    </View>
                    <Text style={s.annTitleText} numberOfLines={1}>{item.title}</Text>
                    <Text style={s.annDescText} numberOfLines={2}>{contentText}</Text>
                    <View style={s.annFooterRow}>
                      <View style={s.annAuthorSection}>
                        <Ionicons name="person-outline" size={10} color={Colors.gray400} />
                        <Text style={s.annAuthorText}>Admin</Text>
                      </View>
                      <View style={s.annFooterDivider} />
                      <View style={s.annDateSection}>
                        <Ionicons name="calendar-outline" size={10} color={Colors.gray400} />
                        <Text style={s.annDateText}>{formattedDate}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },

  // Header
  header: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
    overflow: 'hidden',
  },
  hCircle1: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.06)', top: -60, right: -40 },
  hCircle2: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -20, left: -20 },
  hRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  hLeft: { flex: 1 },
  hGreeting: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginBottom: 3 },
  hName: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.4 },
  hRole: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  hRight: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  notifBtn: { width: 42, height: 42, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  notifDot: { position: 'absolute', top: -1, right: -1, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: '#F87171', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#4DA8DA' },
  notifDotTxt: { fontSize: 8, color: '#fff', fontWeight: '800' },
  avatarWrap: { position: 'relative' },
  avatarOnline: { position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: 5, backgroundColor: '#34D399', borderWidth: 2, borderColor: '#4DA8DA' },

  // Attendance strip
  attStrip: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  attSlot: { flex: 1, alignItems: 'center', gap: 3 },
  attSlotLabel: { fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 2 },
  attSlotVal: { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  attDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 2 },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, backgroundColor: '#F3F4F6', gap: 16 },

  // Section
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2, marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#163E57', letterSpacing: -0.2 },
  seeAll: { fontSize: 12, color: Colors.primary, fontWeight: '600' },

  // Quick Actions
  qaRow: { paddingBottom: 4, gap: 8 },
  qaItem: { alignItems: 'center', width: 90 },
  qaCircle: { width: 46, height: 46, borderRadius: 12, backgroundColor: IconBox.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 6, ...IconBox.shadow as any },
  qaLabel: { fontSize: 12, color: '#3A7399', fontWeight: '600', textAlign: 'center' },

  // Stats Grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    ...Shadow.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIconBox: { width: IconBox.sizeSmall, height: IconBox.sizeSmall, borderRadius: 8, backgroundColor: IconBox.bg, alignItems: 'center', justifyContent: 'center', marginRight: 14, ...IconBox.shadow as any },
  statValue: { fontSize: 22, fontWeight: '600', color: '#163E57', letterSpacing: -0.5, lineHeight: 30 },
  statLabel: { fontSize: 11, color: '#45556C', marginTop: 3, fontWeight: '500' },

  // Profile Card
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  profileCardHeader: {
    height: 90,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    height: 24,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
    marginRight: 6,
  },
  activeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#34D399',
    letterSpacing: 0.5,
  },
  avatarOverlayContainer: {
    alignItems: 'center',
    marginTop: -45,
    marginBottom: 12,
  },
  largeAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: Colors.white,
    position: 'relative',
    ...Shadow.sm,
  },
  largeAvatarGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeAvatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  profileDetails: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.gray900,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  titleContainer: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  profileTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 0.2,
  },
  deptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  profileDept: {
    fontSize: 12,
    color: Colors.gray500,
    fontWeight: '600',
  },
  metaGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#FCFDFF',
  },
  metaBox: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  metaBoxBorder: {
    borderLeftWidth: 1,
    borderColor: '#F1F5F9',
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.gray400,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.gray900,
  },

  // Attendance Card
  attendanceCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 6,
    ...Shadow.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.gray900,
  },
  cardSubtitle: {
    fontSize: 10,
    color: Colors.gray400,
    fontWeight: '600',
    marginTop: 1,
  },
  radialContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  radialOutline: {
    width: 155,
    height: 155,
    borderRadius: 77.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#fff',
    ...Shadow.sm,
  },
  svgRing: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  radialInner: {
    width: 135,
    height: 135,
    borderRadius: 67.5,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EFF2F6',
  },
  radialTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  radialLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8E9AA8',
    letterSpacing: 0.8,
  },
  radialTime: {
    fontSize: 30,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: -0.5,
  },
  radialTimeActive: {
    color: '#10B981',
  },
  radialSeconds: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E9AA8',
    marginTop: 2,
  },
  radialBadge: {
    position: 'absolute',
    bottom: -15,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 95,
    ...Shadow.sm,
  },
  radialBadgeInactive: {
    backgroundColor: '#F1F5F9',
  },
  radialBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.5,
    lineHeight: 10,
    textAlign: 'center',
  },
  radialBadgeTextInactive: {
    fontSize: 8,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
    lineHeight: 10,
    textAlign: 'center',
  },
  attGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 8,
  },
  attBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#EFF2F6',
    alignItems: 'center',
  },
  attLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: Colors.gray400,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  attValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.gray900,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
    // borderTopWidth: 1,
    // borderColor: '#F1F5F9',
    marginBottom: 8,
  },
  locText: {
    fontSize: 10,
    color: Colors.gray500,
    fontWeight: '500',
  },
  attCardWeekTitle: { fontSize: 13, fontWeight: '700', color: '#163E57', marginBottom: 10, borderTopWidth: 1, borderColor: '#F1F5F9', paddingTop: 14 },
  attCardWeekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  attCardDay: { alignItems: 'center', gap: 6 },
  attCardDayLabel: { fontSize: 11, color: '#5590B5', fontWeight: '600' },
  attCardDayDot: { width: 28, height: 28, borderRadius: 14, position: 'relative' },
  attCardDayPulse: { position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: 18, borderWidth: 2, borderColor: '#4DA8DA60' },
  attCardLegend: { flexDirection: 'row', justifyContent: 'space-around' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendTxt: { fontSize: 11, color: '#5590B5' },
  attCardBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6, paddingHorizontal: 24, paddingVertical: 8, borderRadius: 999, marginBottom: 12, ...Shadow.sm },
  attCardBtnTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },

  buttonContainer: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginTop: 10,
  },

  // Notifications Card
  notificationsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    ...Shadow.sm,
  },
  cardBellBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  cardHeaderAction: {
    padding: 4,
  },
  notifList: {
    gap: 8,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  notifItemUnread: {
    backgroundColor: '#EFF6FF',
  },
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3.5,
    backgroundColor: '#2563EB',
  },
  notifIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#EFF2F6',
  },
  notifContent: {
    flex: 1,
    marginRight: 8,
  },
  notifTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.gray900,
    marginBottom: 3,
  },
  notifDesc: {
    fontSize: 11,
    color: Colors.gray500,
    lineHeight: 14,
    marginBottom: 6,
  },
  notifDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  notifDate: {
    fontSize: 9,
    color: Colors.gray400,
    fontWeight: '600',
  },
  notifCheck: {
    alignSelf: 'center',
    padding: 4,
  },

  // Announcements Card
  announcementsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    ...Shadow.sm,
  },
  annList: {
    gap: 8,
  },
  annItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  annPriorityBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3.5,
  },
  annIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#EFF2F6',
  },
  annContent: {
    flex: 1,
  },
  annMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  annPriorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  annPriorityText: {
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  annCategoryText: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.gray500,
  },
  annTitleText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.gray900,
    marginBottom: 3,
  },
  annDescText: {
    fontSize: 11,
    color: Colors.gray500,
    lineHeight: 14,
    marginBottom: 6,
  },
  annFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  annAuthorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  annAuthorText: {
    fontSize: 9,
    color: Colors.gray500,
    fontWeight: '600',
  },
  annFooterDivider: {
    width: 1,
    height: 8,
    backgroundColor: Colors.gray300,
    marginHorizontal: 2,
  },
  annDateSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  annDateText: {
    fontSize: 9,
    color: Colors.gray400,
    fontWeight: '600',
  },
  quickActionsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    ...Shadow.sm,
  },

  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },

  quickActionItem: {
    flex: 1,
    alignItems: 'center',
  },

  quickActionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },

  quickActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#45556C',
    textAlign: 'center',
  },
});

