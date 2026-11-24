import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, StatusBar, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow, IconBox } from '../../design-system/tokens';
import { Card, ProgressBar } from '../../design-system/components/Card';
import { Badge, statusToVariant } from '../../design-system/components/Badge';
import { Avatar } from '../../design-system/components/Avatar';
import { fetchProjectsApi, Project } from '../../services/projectService';

export default function ProjectsScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'on-hold'>('all');

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchProjectsApi();
      if (res && Array.isArray(res.items)) {
        setProjects(res.items);
      } else {
        setProjects([]);
      }
    } catch (err) {
      console.warn('Failed to load projects:', err);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const filtered = filter === 'all'
    ? projects
    : projects.filter(p => (p.status || '').toLowerCase() === filter.toLowerCase());

  const activeCount = projects.filter(p => (p.status || '').toLowerCase() === 'active').length;
  const onHoldCount = projects.filter(p => (p.status || '').toLowerCase() === 'on-hold').length;
  const totalTasksDone = projects.reduce((a, p) => a + (p.tasksCompleted || 0), 0);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.header}>
        <View style={styles.headerCircle} />
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Projects</Text>
        <Text style={styles.headerSub}>{projects.length} total projects</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{activeCount}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{onHoldCount}</Text>
            <Text style={styles.statLabel}>On Hold</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{totalTasksDone}</Text>
            <Text style={styles.statLabel}>Tasks Done</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {(['all', 'active', 'on-hold'] as const).map(f => (
            <TouchableOpacity key={f} style={[styles.filterTab, filter === f && styles.filterTabActive]} onPress={() => setFilter(f)}>
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'all' ? 'All Projects' : f === 'active' ? 'Active' : 'On Hold'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={{ marginTop: 8, fontSize: Typography.fontSize.sm, color: Colors.gray500 }}>Loading projects...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Ionicons name="folder-open-outline" size={48} color={Colors.gray300} />
            <Text style={{ marginTop: 12, fontSize: Typography.fontSize.base, fontWeight: '600', color: Colors.gray600 }}>
              No projects found
            </Text>
          </View>
        ) : (
          filtered.map(project => {
            const progress = project.progress ?? 0;
            const statusKey = project.status || 'active';
            const teamMembers = Array.isArray(project.team) ? project.team : [];
            return (
              <Card key={project._id} onPress={() => router.push(`/projects/${project._id}` as any)} elevated>
                <View style={styles.projectHeader}>
                  <View style={styles.projectIconBox}>
                    <Ionicons name="folder-open-outline" size={22} color={Colors.primary} />
                  </View>
                  <View style={styles.projectMeta}>
                    <Text style={styles.projectName}>{project.name}</Text>
                    {project.client ? <Text style={styles.projectClient}>Client: {project.client}</Text> : null}
                  </View>
                  <Badge label={project.status || 'Active'} variant={statusToVariant[statusKey] || 'neutral'} />
                </View>
                {project.description ? (
                  <Text style={styles.projectDesc} numberOfLines={2}>{project.description}</Text>
                ) : null}
                <View style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>Progress</Text>
                    <Text style={[styles.progressValue, { color: progress > 75 ? Colors.success : progress > 40 ? Colors.primary : Colors.warning }]}>
                      {progress}%
                    </Text>
                  </View>
                  <ProgressBar progress={progress} color={progress > 75 ? Colors.success : progress > 40 ? Colors.primary : Colors.warning} height={8} />
                </View>
                <View style={styles.projectDetails}>
                  <View style={styles.detailItem}>
                    <Ionicons name="checkmark-circle-outline" size={14} color={Colors.gray500} />
                    <Text style={styles.detailText}> {project.tasksCompleted || 0}/{project.tasksTotal || 0} tasks</Text>
                  </View>
                  {project.endDate ? (
                    <View style={styles.detailItem}>
                      <Ionicons name="calendar-outline" size={14} color={Colors.gray500} />
                      <Text style={styles.detailText}> Due {project.endDate}</Text>
                    </View>
                  ) : null}
                  {project.priority ? (
                    <Badge label={project.priority} variant={project.priority === 'high' ? 'danger' : 'warning'} />
                  ) : null}
                </View>
                {teamMembers.length > 0 && (
                  <View style={styles.teamSection}>
                    <Text style={styles.teamLabel}>Team</Text>
                    <View style={styles.teamAvatars}>
                      {teamMembers.slice(0, 4).map((t, i) => (
                        <Avatar key={i} initials={typeof t === 'string' ? t : (t.initials || t.name?.[0] || 'U')} size={28} style={{ marginLeft: i > 0 ? -10 : 0 }} />
                      ))}
                      {teamMembers.length > 4 && (
                        <View style={styles.moreMembersBox}>
                          <Text style={styles.moreMembersText}>+{teamMembers.length - 4}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </Card>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { backgroundColor: Colors.primary, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 56, paddingHorizontal: Spacing[4], paddingBottom: Spacing[5], overflow: 'hidden' },
  headerCircle: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(96,165,250,0.15)', top: -80, right: -60 },
  backBtn: { marginBottom: 8 },
  headerTitle: { fontSize: Typography.fontSize.xl, fontWeight: '800', color: Colors.white, marginBottom: 4 },
  headerSub: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.7)', marginBottom: Spacing[4] },
  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: Radius.lg, paddingVertical: 12 },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: Typography.fontSize['2xl'], fontWeight: '800', color: Colors.white },
  statLabel: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing[4] },
  filterRow: { marginBottom: Spacing[3] },
  filterTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, marginRight: 8, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.gray200 },
  filterTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: Typography.fontSize.sm, color: Colors.gray600, fontWeight: '600' },
  filterTextActive: { color: Colors.white },
  projectHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  projectIconBox: { width: IconBox.size, height: IconBox.size, borderRadius: IconBox.radius, backgroundColor: IconBox.bg, alignItems: 'center', justifyContent: 'center', marginRight: 12, ...IconBox.shadow as any },
  projectMeta: { flex: 1 },
  projectName: { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.gray900 },
  projectClient: { fontSize: Typography.fontSize.xs, color: Colors.gray500, marginTop: 2 },
  projectDesc: { fontSize: Typography.fontSize.sm, color: Colors.gray500, lineHeight: 20, marginBottom: 14 },
  progressSection: { marginBottom: 14 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: Typography.fontSize.xs, color: Colors.gray500 },
  progressValue: { fontSize: Typography.fontSize.sm, fontWeight: '700' },
  projectDetails: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  detailItem: { flexDirection: 'row', alignItems: 'center' },
  detailText: { fontSize: Typography.fontSize.xs, color: Colors.gray600 },
  teamSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  teamLabel: { fontSize: Typography.fontSize.xs, color: Colors.gray500, fontWeight: '600' },
  teamAvatars: { flexDirection: 'row' },
  moreMembersBox: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.gray200, marginLeft: -10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.white },
  moreMembersText: { fontSize: 9, color: Colors.gray600, fontWeight: '700' },
});
